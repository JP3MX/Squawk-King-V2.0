#!/usr/bin/env node
/**
 * Squawk King IA — migration runner
 *
 * Non-negotiable: every run takes a full pg_dump backup BEFORE applying
 * any new migration file. Migrations are applied in filename order,
 * tracked in a schema_migrations ledger, and never re-run or rolled back
 * automatically. Migration files must only ADD schema — never DROP TABLE
 * or DELETE FROM an existing table's rows.
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/squawk_king";
const MIGRATIONS_DIR = path.join(__dirname, "..", "db", "migrations");
const BACKUPS_DIR = path.join(__dirname, "..", "db", "backups");

function backupDatabase() {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(BACKUPS_DIR, `pre-migration-${stamp}.sql`);
  const url = new URL(DATABASE_URL);
  const dbName = url.pathname.replace("/", "");
  const env = { ...process.env, PGPASSWORD: url.password };
  const cmd = `pg_dump -h ${url.hostname} -p ${url.port || 5432} -U ${url.username} -d ${dbName} -f "${outFile}"`;
  console.log(`[migrate] Backing up database to ${outFile} ...`);
  execSync(cmd, { env, stdio: "inherit" });
  console.log("[migrate] Backup complete.");
  return outFile;
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // Ledger table itself is created without needing a prior backup (nothing to lose yet)
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const applied = new Set(
    (await client.query("SELECT filename FROM schema_migrations")).rows.map((r) => r.filename)
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log("[migrate] No pending migrations. Database is up to date.");
    await client.end();
    return;
  }

  console.log(`[migrate] Pending migrations: ${pending.join(", ")}`);
  backupDatabase(); // mandatory, unconditional, before any DDL below

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log(`[migrate] Applying ${file} ...`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`[migrate] Applied ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`[migrate] FAILED on ${file}, rolled back this migration only:`, err.message);
      process.exit(1);
    }
  }

  await client.end();
  console.log("[migrate] All migrations applied successfully.");
}

run().catch((err) => {
  console.error("[migrate] Fatal error:", err);
  process.exit(1);
});
