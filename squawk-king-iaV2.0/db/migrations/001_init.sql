-- 001_init.sql
-- Squawk King IA — initial schema
-- Rule: migrations only ADD. Never DROP or DELETE existing columns/rows in later migrations.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('mechanic', 'admin', 'owner')) DEFAULT 'mechanic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each user's own logbook entries (past work, searchable diagnostic history)
CREATE TABLE IF NOT EXISTS logbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aircraft_make TEXT NOT NULL,
  aircraft_model TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  ata_chapter TEXT, -- e.g. "24" for electrical power
  total_time NUMERIC(10,1),
  issue_description TEXT NOT NULL,
  work_performed TEXT NOT NULL,
  part_numbers TEXT[], -- nullable array of part numbers replaced
  signature_name TEXT,
  signature_cert TEXT, -- A&P/IA certificate number, entered by the signing mechanic only
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true, -- soft delete only; rows are never hard-deleted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logbook_user ON logbook_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_logbook_ata ON logbook_entries(ata_chapter);
CREATE INDEX IF NOT EXISTS idx_logbook_text_search ON logbook_entries
  USING GIN (to_tsvector('english', issue_description || ' ' || work_performed));

-- FAA guidance database, keyed by ATA chapter. Every row is a citable source.
CREATE TABLE IF NOT EXISTS faa_guidance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ata_chapter TEXT NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL, -- e.g. 'FAR', 'AC', 'AD', 'SB', 'IPC'
  regulation_number TEXT, -- e.g. "14 CFR 43.13"
  section TEXT, -- e.g. "(a)(1)"
  page TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faa_ata ON faa_guidance(ata_chapter);
CREATE INDEX IF NOT EXISTS idx_faa_text_search ON faa_guidance
  USING GIN (to_tsvector('english', title || ' ' || content));

-- Live diagnostic sessions: tracks the clarifying-question loop (max 3 questions)
CREATE TABLE IF NOT EXISTS diagnostic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initial_issue TEXT NOT NULL,
  ata_chapter TEXT,
  questions_asked INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('active', 'resolved', 'no_sources_found', 'abandoned')) DEFAULT 'active',
  conversation JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{role, content, citations?}]
  final_citations JSONB, -- citations backing the confirmed diagnosis
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON diagnostic_sessions(user_id);
