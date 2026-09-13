import { pool } from "@/lib/db/pool";
import type { DiagnosticSource } from "./provider";

/**
 * Full sentences (especially voice transcripts) rarely match every word of
 * a source document, so plainto_tsquery's implicit AND-of-all-terms is too
 * strict and returns nothing for realistic queries. Build an OR query across
 * the significant words instead, ranked by relevance, so a sentence like
 * "Battery won't hold a charge on the Cessna 172" still surfaces a document
 * about battery maintenance even though most of the sentence doesn't appear
 * in it verbatim.
 */
function toOrTsQuery(text: string): string {
  const stopwords = new Set([
    "the", "a", "an", "on", "in", "of", "to", "and", "or", "is", "are", "was",
    "were", "it", "its", "wont", "won't", "will", "not", "with", "for", "my",
    "me", "i", "this", "that",
  ]);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopwords.has(w));
  if (words.length === 0) return "";
  // Escape single quotes defensively; words are already alnum-only from the regex above.
  return words.map((w) => `${w}:*`).join(" | ");
}

/**
 * Very rough ATA-chapter guesser from free text. Real implementation would
 * use a proper classifier; this keyword map is enough to route the demo
 * flow (electrical/battery -> ATA 24, landing gear -> ATA 32, starter -> ATA 80).
 */
const ATA_KEYWORDS: Record<string, string> = {
  battery: "24",
  electrical: "24",
  alternator: "24",
  voltage: "24",
  "landing gear": "32",
  gear: "32",
  "won't retract": "32",
  starter: "80",
  crank: "80",
  "won't start": "80",
};

export function guessAtaChapter(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [keyword, ata] of Object.entries(ATA_KEYWORDS)) {
    if (lower.includes(keyword)) return ata;
  }
  return null;
}

export async function searchLogbook(
  userId: string,
  query: string,
  ataChapter: string | null
): Promise<DiagnosticSource[]> {
  const tsQuery = toOrTsQuery(query);
  if (!tsQuery) return [];
  const result = await pool.query(
    `SELECT id, aircraft_make, aircraft_model, registration_number, ata_chapter,
            issue_description, work_performed, entry_date,
            ts_rank(to_tsvector('english', issue_description || ' ' || work_performed), to_tsquery('english', $3)) AS rank
     FROM logbook_entries
     WHERE user_id = $1
       AND is_active = true
       AND ($2::text IS NULL OR ata_chapter = $2)
       AND to_tsvector('english', issue_description || ' ' || work_performed) @@ to_tsquery('english', $3)
     ORDER BY rank DESC, entry_date DESC
     LIMIT 5`,
    [userId, ataChapter, tsQuery]
  );

  return result.rows.map((row) => ({
    id: row.id,
    origin: "logbook" as const,
    ata_chapter: row.ata_chapter,
    title: `Prior entry: ${row.aircraft_make} ${row.aircraft_model} (${row.registration_number}), ${row.entry_date.toISOString().slice(0, 10)}`,
    content: `Issue: ${row.issue_description}\nWork performed: ${row.work_performed}`,
    citation: {
      source_type: "logbook",
      regulation_number: null,
      section: null,
      page: null,
      title: `Your logbook entry for ${row.registration_number} dated ${row.entry_date.toISOString().slice(0, 10)}`,
    },
  }));
}

export async function searchFaaGuidance(
  query: string,
  ataChapter: string | null
): Promise<DiagnosticSource[]> {
  const tsQuery = toOrTsQuery(query);
  if (!tsQuery) return [];
  const result = await pool.query(
    `SELECT id, ata_chapter, title, source_type, regulation_number, section, page, content,
            ts_rank(to_tsvector('english', title || ' ' || content), to_tsquery('english', $2)) AS rank
     FROM faa_guidance
     WHERE ($1::text IS NULL OR ata_chapter = $1)
       AND to_tsvector('english', title || ' ' || content) @@ to_tsquery('english', $2)
     ORDER BY rank DESC
     LIMIT 5`,
    [ataChapter, tsQuery]
  );

  return result.rows.map((row) => ({
    id: row.id,
    origin: "faa_guidance" as const,
    ata_chapter: row.ata_chapter,
    title: row.title,
    content: row.content,
    citation: {
      source_type: row.source_type,
      regulation_number: row.regulation_number,
      section: row.section,
      page: row.page,
      title: row.title,
    },
  }));
}

export async function retrieveSources(
  userId: string,
  query: string
): Promise<{ sources: DiagnosticSource[]; ataChapter: string | null }> {
  const ataChapter = guessAtaChapter(query);
  const [logbookSources, faaSources] = await Promise.all([
    searchLogbook(userId, query, ataChapter),
    searchFaaGuidance(query, ataChapter),
  ]);
  return { sources: [...faaSources, ...logbookSources], ataChapter };
}
