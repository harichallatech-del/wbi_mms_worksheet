-- Metadata for the normalized API snapshots stored in snapshot_<tab> tables.
-- Snapshot table columns are generated from the shared TABLES contract in wbi_common.py.
CREATE TABLE IF NOT EXISTS schema_version (
  component TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  installed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS refresh_runs (
  refresh_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','failed')),
  rows_loaded INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);
CREATE TABLE IF NOT EXISTS snapshot_table_status (
  table_name TEXT PRIMARY KEY,
  refresh_id TEXT NOT NULL REFERENCES refresh_runs(refresh_id),
  row_count INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_runs_finished ON refresh_runs(finished_at);
