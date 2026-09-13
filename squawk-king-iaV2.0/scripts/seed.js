#!/usr/bin/env node
/**
 * Seeds a small, real starter set of FAA guidance rows so the diagnostic
 * flow has genuine citable sources. This is a seed corpus, not exhaustive —
 * production would load the full FAA guidance library keyed by ATA chapter.
 * Safe to re-run: uses ON CONFLICT-free inserts guarded by a check, never
 * deletes existing rows.
 */
const { Client } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/squawk_king";

const GUIDANCE = [
  {
    ata_chapter: "24",
    title: "Aircraft Battery Maintenance and Inspection",
    source_type: "AC",
    regulation_number: "AC 43.13-1B",
    section: "Chapter 11, Section 3, Para 11-27",
    page: "11-6",
    content:
      "Lead-acid and nickel-cadmium aircraft batteries should be inspected for electrolyte level, terminal corrosion, and case damage at each scheduled inspection. A battery that will not hold a charge, shows swelling, or exhibits electrolyte leakage should be removed from service and capacity-tested or replaced per manufacturer instructions.",
  },
  {
    ata_chapter: "24",
    title: "Rules for Airworthy Maintenance and Alterations",
    source_type: "FAR",
    regulation_number: "14 CFR 43.13",
    section: "(a)",
    page: "N/A",
    content:
      "Each person performing maintenance, alteration, or preventive maintenance on an aircraft shall use methods, techniques, and practices acceptable to the Administrator, using the tools, equipment, and test apparatus necessary to ensure completion of the work in accordance with accepted industry practices.",
  },
  {
    ata_chapter: "24",
    title: "Maintenance Records",
    source_type: "FAR",
    regulation_number: "14 CFR 43.9",
    section: "(a)(1)-(4)",
    page: "N/A",
    content:
      "Each person who maintains, performs preventive maintenance, or alters an aircraft shall make an entry in the maintenance record containing a description of the work performed, the date of completion, the name of the person performing the work, and, if approved for return to service, the signature and certificate number of the person approving the work.",
  },
  {
    ata_chapter: "32",
    title: "Landing Gear Retraction System Rigging",
    source_type: "AC",
    regulation_number: "AC 43.13-1B",
    section: "Chapter 9, Section 1, Para 9-3",
    page: "9-2",
    content:
      "Landing gear retraction and extension mechanisms should be checked for correct rigging, freedom of movement, and security of all locking devices. Any binding, excessive play, or failure of an uplock or downlock to engage fully must be corrected before further flight.",
  },
  {
    ata_chapter: "80",
    title: "Reciprocating Engine Starting System Troubleshooting",
    source_type: "AC",
    regulation_number: "AC 43.13-1B",
    section: "Chapter 8, Section 2, Para 8-27",
    page: "8-11",
    content:
      "A starter that engages but fails to crank the engine, or cranks slowly, should be checked for low battery voltage, corroded or loose battery cable connections, or a worn starter drive (Bendix) before the starter motor itself is suspected.",
  },
];

async function seed() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  for (const g of GUIDANCE) {
    const existing = await client.query(
      "SELECT id FROM faa_guidance WHERE regulation_number = $1 AND section = $2",
      [g.regulation_number, g.section]
    );
    if (existing.rows.length > 0) continue;
    await client.query(
      `INSERT INTO faa_guidance (ata_chapter, title, source_type, regulation_number, section, page, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [g.ata_chapter, g.title, g.source_type, g.regulation_number, g.section, g.page, g.content]
    );
    console.log(`[seed] Inserted: ${g.regulation_number} ${g.section}`);
  }

  await client.end();
  console.log("[seed] Done.");
}

seed().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
