# WBI SQLite data

`wbi_operations.db` is an initialized starter database with reference values only. It contains no production records, live login accounts, customer inquiries, audit records, or passkey details.

The SQL files are applied in numeric order:

1. `001_wbi_operational_core.sql` — source-aligned WBI entities and constraints.
2. `002_dashboard_snapshots.sql` — refresh runs, schema versions, and snapshot metadata.
3. `003_reference_form_choices.sql` — choices found in the source handoff.
4. `004_user_reference_defaults.sql` — the user's products, operator labels, machine locations, and selectable starter reference values.

The `snapshot_*` tables are created from the versioned column lists in `shared/wbi_common.py`. Data refresh uses a transaction to replace the last successful snapshot. API output remains authoritative; the local SQL schema is a reporting mirror, not a replacement for WBI's PostgreSQL database.

The user-provided reference labels are flagged as starter values. After a successful WBI API read, live active reference data replaces workbook dropdown values. The manager snapshot can include inquiry name/phone and login-user phone because those screens require them. Keep the database in manager-restricted storage. The package never queries or stores authentication secrets, operator Aadhaar/onboarding data, or passkey credential material.
