import { pool } from "@/lib/db/pool";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";

export default async function LogbookPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await pool.query(
    `SELECT id, aircraft_make, aircraft_model, registration_number, ata_chapter, total_time,
            issue_description, work_performed, part_numbers, signature_name, signature_cert, entry_date
     FROM logbook_entries
     WHERE user_id = $1 AND is_active = true
     ORDER BY entry_date DESC, created_at DESC`,
    [user.userId]
  );

  return (
    <div className="flex-1 max-w-lg mx-auto w-full p-4 space-y-4">
      <h1 className="text-[var(--amber)] tracking-wide text-lg">Your Logbook</h1>
      {result.rows.length === 0 && (
        <p className="readout-mono text-sm text-[var(--text-dim)]">
          No entries yet. Confirmed diagnoses will show up here.
        </p>
      )}
      {result.rows.map((row) => (
        <div key={row.id} className="deck-panel p-4 space-y-2 print:break-inside-avoid">
          <div className="flex justify-between items-baseline">
            <span className="readout-mono text-sm text-[var(--text-primary)]">
              {row.aircraft_make} {row.aircraft_model} · {row.registration_number}
            </span>
            <span className="readout-mono text-xs text-[var(--text-dim)]">
              {new Date(row.entry_date).toISOString().slice(0, 10)}
            </span>
          </div>
          <p className="readout-mono text-xs text-[var(--text-dim)]">
            ATA {row.ata_chapter ?? "n/a"} · {row.total_time ?? "—"} hrs total time
          </p>
          <p className="readout-mono text-sm text-[var(--text-primary)]">
            <span className="text-[var(--text-dim)]">Issue: </span>
            {row.issue_description}
          </p>
          <p className="readout-mono text-sm text-[var(--text-primary)]">
            <span className="text-[var(--text-dim)]">Work performed: </span>
            {row.work_performed}
          </p>
          {row.part_numbers?.length > 0 && (
            <p className="readout-mono text-xs text-[var(--text-dim)]">
              Parts: {row.part_numbers.join(", ")}
            </p>
          )}
          <p className="readout-mono text-xs text-[var(--green)]">
            Signed: {row.signature_name} · Cert {row.signature_cert}
          </p>
        </div>
      ))}
    </div>
  );
}
