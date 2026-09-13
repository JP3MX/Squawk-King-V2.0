# Squawk King IA — V2.0

A mobile-first web app that helps aircraft mechanics diagnose maintenance
issues using their own logbooks and FAA guidance, and closes out fixes as
14 CFR 43.9-compliant logbook entries. Built fresh with Next.js, TypeScript,
Tailwind, and Postgres — no legacy code carried over.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS 4
- Postgres (raw SQL via `pg`, no ORM)
- Auth: bcrypt password hashing + JWT httpOnly session cookies (`jose`)
- AI: a swappable `AIProvider` interface (`lib/ai/provider.ts`), with an
  Anthropic implementation included (`lib/ai/anthropic-provider.ts`)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
node scripts/migrate.js      # backs up the DB, then applies db/migrations/*.sql
node scripts/seed.js         # seeds a small starter set of real FAA guidance rows
npm run dev
```

Open http://localhost:3000, register an account, and use the dashboard to
describe an issue by voice or text.

## Non-negotiables this build honors

- **Backup before migration.** `scripts/migrate.js` runs a full `pg_dump`
  into `db/backups/` before applying any pending migration file. This is
  unconditional — it cannot be skipped by a flag.
- **Never delete logbook rows.** `logbook_entries` has no DELETE or UPDATE
  path in the app. Rows are inserted once; a future "remove" feature should
  set `is_active = false` rather than delete.
- **AI provider is swappable.** The rest of the app only imports from
  `lib/ai` (`getAIProvider()`), never a vendor SDK directly. To add a new
  provider: implement the `AIProvider` interface in a new file under
  `lib/ai/`, then add one branch to `getAIProvider()` in `lib/ai/index.ts`.
- **Never fabricates.** The diagnose API refuses to return a `"diagnosis"`
  result with zero citations, even if the model tries to produce one — see
  the check in `AnthropicProvider.runDiagnosticTurn`. With no sources and
  after 3 clarifying questions, it returns `"no_sources_found"` and points
  the mechanic to an A&P or the manufacturer.

## How the diagnostic flow works

1. `POST /api/diagnose` with `{ action: "start", issue }` — retrieves
   matching sources from the user's own `logbook_entries` and the shared
   `faa_guidance` table (full-text search, ranked, OR-matched across
   significant words so a full sentence still finds a relevant document).
2. The AI provider is given ONLY those retrieved sources and must respond
   with one of three shapes: a clarifying question, a cited diagnosis, or
   "no sources found."
3. `POST /api/diagnose` again with `{ action: "answer", sessionId, answer }`
   for each follow-up. Capped at 3 clarifying questions server-side,
   independent of what the model claims it asked.
4. Once a diagnosis with citations comes back, the mechanic can confirm and
   move to logbook closeout (`POST /api/logbook`), which drafts a
   14 CFR 43.9 entry (date, aircraft make/model, registration, total time,
   work performed, part numbers, signature block) that the mechanic can
   edit before signing. Saving is insert-only.

## Voice input

Voice-to-text runs client-side via the browser's native Web Speech API
(`components/VoiceRecorder.tsx`) — no server round-trip, no added latency,
works offline-tolerant for short utterances. `AIProvider.transcribe()` is
defined for a future server-side provider (e.g. Whisper) if browser support
or accuracy on aviation jargon/tail numbers ever needs an upgrade; it is not
wired up in this build.

## What's real vs. a starter seed

`scripts/seed.js` loads five real regulatory/guidance excerpts (14 CFR 43.9,
14 CFR 43.13, three AC 43.13-1B sections) covering ATA 24 (electrical/
battery), 32 (landing gear), and 80 (engine starting) — enough to prove the
end-to-end flow against genuine citable text. A production deployment needs
the full FAA guidance corpus loaded the same way, keyed by ATA chapter.

## Known limitations to polish next

- ATA-chapter classification from free text (`lib/ai/retrieval.ts`,
  `guessAtaChapter`) is a small keyword map, not a real classifier.
- No password reset, email verification, or rate limiting yet.
- No automated test suite — verification so far has been manual
  (build + live curl against a running Postgres instance).
