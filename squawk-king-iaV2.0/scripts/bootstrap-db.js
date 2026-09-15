#!/usr/bin/env node
/**
 * Initialize a brand-new production database before the web server starts.
 *
 * This intentionally runs only when the database has no application tables.
 * Existing databases must continue to use scripts/migrate.js so they receive
 * the project's required pre-migration backup.
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL;
const MIGRATIONS_DIR = path.join(__dirname, "..", "db", "migrations");

async function run() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const existing = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> 'schema_migrations'
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set(
      (await client.query("SELECT filename FROM schema_migrations")).rows.map(
        (row) => row.filename
      )
    );

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const pending = files.filter((file) => !applied.has(file));

    if (pending.length === 0) {
      console.log("[bootstrap-db] Database is ready.");
      return;
    }

    if (existing.rows.length > 0) {
      throw new Error(
        "Database already contains application tables but has pending migrations. Run npm run migrate so a backup is taken first."
      );
    }

    console.log("[bootstrap-db] Empty database detected; applying initial schema.");

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(`[bootstrap-db] Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("[bootstrap-db] Database initialization complete.");
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("[bootstrap-db] Fatal error:", error);
  process.exit(1);
});
