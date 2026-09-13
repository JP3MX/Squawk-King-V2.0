import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db/pool";
import { getCurrentUser } from "@/lib/auth/current-user";

const EntrySchema = z.object({
  sessionId: z.string().uuid().optional(),
  aircraft_make: z.string().min(1),
  aircraft_model: z.string().min(1),
  registration_number: z.string().min(1),
  ata_chapter: z.string().optional().nullable(),
  total_time: z.number().nonnegative().optional().nullable(),
  issue_description: z.string().min(1),
  work_performed: z.string().min(1),
  part_numbers: z.array(z.string()).optional().default([]),
  signature_name: z.string().min(1),
  signature_cert: z.string().min(1),
  entry_date: z.string().optional(), // YYYY-MM-DD
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // Private to the account: filtered by user_id, active rows only.
  const result = await pool.query(
    `SELECT id, aircraft_make, aircraft_model, registration_number, ata_chapter, total_time,
            issue_description, work_performed, part_numbers, signature_name, signature_cert,
            entry_date, created_at
     FROM logbook_entries
     WHERE user_id = $1 AND is_active = true
     ORDER BY entry_date DESC, created_at DESC`,
    [user.userId]
  );
  return NextResponse.json({ entries: result.rows });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json();
  const parsed = EntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  // Insert-only. Logbook rows are never updated or deleted by this route.
  const result = await pool.query(
    `INSERT INTO logbook_entries
       (user_id, aircraft_make, aircraft_model, registration_number, ata_chapter, total_time,
        issue_description, work_performed, part_numbers, signature_name, signature_cert, entry_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, COALESCE($12, CURRENT_DATE))
     RETURNING id, entry_date`,
    [
      user.userId,
      d.aircraft_make,
      d.aircraft_model,
      d.registration_number,
      d.ata_chapter ?? null,
      d.total_time ?? null,
      d.issue_description,
      d.work_performed,
      d.part_numbers,
      d.signature_name,
      d.signature_cert,
      d.entry_date ?? null,
    ]
  );

  if (d.sessionId) {
    await pool.query(
      `UPDATE diagnostic_sessions SET status = 'resolved', updated_at = now() WHERE id = $1 AND user_id = $2`,
      [d.sessionId, user.userId]
    );
  }

  return NextResponse.json({ id: result.rows[0].id, entry_date: result.rows[0].entry_date });
}
