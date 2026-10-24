# WBI MMS Role Workbooks and Cloud Project

This package contains the three separate WBI operations workbooks requested, shared Python data and queue tools, SQLite schemas and reference defaults, an Excel Office Script, a Google Apps Script, and offline tests.

## Role workbooks

| File | Visible tabs |
|---|---|
| `excel/workbooks/WBI_Manager.xlsx` | Dashboard, Stock Dashboard, Stock Position, Admin Settings, Audit Log, Inquiries |
| `excel/workbooks/WBI_Stock_Monitor.xlsx` | Stock Dashboard, Stock Positions |
| `excel/workbooks/WBI_Operators.xlsx` | Manufacturing BW, Manufacturing HB, Maintenance |

Each file contains only its listed tabs. Lookup columns, refreshed source data, and form queues sit to the right on those same sheets, so they do not create extra workbook tabs. Scroll horizontally to inspect those ranges. This is a screen organization choice; workbook contents are not an access-control boundary. Share the three files with separate role groups and keep the Manager file and its SQLite snapshot in restricted storage.

The Manager workbook includes forms for product, status, operator, machine, and login-user management. Managers can create an Operator login or a Stock Monitor login using the `login user` entity and the matching role dropdown. Real login users and their phone numbers are not pre-seeded. After the WBI API refresh or roster sync, active account names populate the Stock Monitor and Operators account dropdowns. The account selector identifies the account using the sheet; it is not written into stock-movement records.

The Manager Stock Position screen includes a stock-movement form and a separate minimum/maximum threshold form. The Stock Monitor workbook follows the source role matrix and keeps stock movements read-only. Operators has separate BW and HB entry screens plus the requested Maintenance page.

## Starter reference data

The included `data/wbi_operations.db` is initialized with the SQL schema and source/user-provided reference choices. It has no real production, login-user, inquiry, audit, or passkey records.

- **Products:** `10 G` / 10 Gauge Wire, `12 G` / 12 Gauge Wire, `16 G` / 16 Gauge Wire, `20 G` / 20 Gauge Wire.
- **Operators:** `HB-Abhishek`, `HB-Nitesh`, `HB-Ravi`, `BW-Nirmal`, `BW-Sahil`, `BW-Sandeep`, `BW-Shivam`.
- **Machines:** `BW 1` and `BW 2` on Floor B; `HB 1` and `HB 2` on Floor A.
- **Stock raw materials:** `5.5 MM Rod`, `Powder`, `Carbide Die`.
- **Other form choices:** Day/Night shifts, Normal/Annealed/Non-Annealed statuses, and the documented downtime, rejection, and maintenance types.

These are starter choices. A successful API refresh replaces workbook dropdown values with current active WBI master data. Confirm starter choices against the live master before submitting real records. Account names, phone numbers, credentials, and passkeys are never seeded.

## Structure

```text
excel/
  workbooks/                 Three prebuilt role .xlsx files
  office_scripts/            Excel for the web controls and queue actions
  office_addin/              Modular Office.js task pane, typed forms and pagination
google_sheets/
  apps_script/               Modular bound Apps Script for menus, validation, and paging
shared/
  wbi_common.py              Shared WBI API extraction, normalization, and logs
  wbi_sqlite.py              SQLite schema initialization and atomic snapshots
  wbi_role_layout.py         One map for role tabs and support ranges
  wbi_publish_excel.py       Microsoft Graph workbook range publisher
  wbi_publish_google.py      Google Sheets API publisher
  wbi_refresh.py             Fetch once, store locally, publish selected roles
  wbi_submit_queue.py        Dry-run-first, allowlisted queue submitter
data/
  schema/                    Modular SQL schema and starter reference records
  wbi_operations.db          Initialized SQLite file with starter lookups only
docs/                        Source handoffs, research, and prompt guidance
tests/                       Offline unit/integration checks
tests/e2e/                   Optional read-only Playwright Google Sheets smoke test
tools/                       Workbook builder source
```

## Getting started

1. Extract the ZIP and install `requirements.txt` into a Python environment.
2. Copy `.env.example` to `.env` and add approved service settings. Keep `.env`, service-account JSON, and API tokens outside shared storage and source control.
3. Initialize or inspect the SQLite reference database with:

   ```bash
   python shared/wbi_sqlite.py
   ```

4. Configure a permitted WBI API identity and one cloud destination. The source handoff does not document an unattended token-issuance flow; obtain the WBI backend owner's approved token and role before scheduling or submitting.
5. Run `python shared/wbi_refresh.py --platform excel` or `--platform google`. By default, it fetches one normalized snapshot, commits it atomically to SQLite, and publishes all three role workbooks. Use repeated `--role manager`, `--role stock-monitor`, or `--role operators` arguments to update only selected workbooks. Add `--publish-existing` to publish the last SQLite snapshot without calling WBI APIs.

Refresh failures stop before updating the cloud workbook if the required WBI reads fail. Each attempt writes a console summary and structured JSON Lines entry to `logs/refresh.jsonl`; bearer tokens and response bodies are not logged.

### Microsoft 365 Excel

Store the three `.xlsx` files in a OneDrive for Business or SharePoint drive. Configure `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`, `MS_GRAPH_DRIVE_ID`, and the three file paths in `.env`. Register and consent only the Graph permissions approved by the tenant administrator. The publisher opens a workbook session, verifies its tabs against the role list, then updates only the helper ranges. It does not recreate or rename workbook tabs.

Import `excel/office_scripts/WBI_Operations.ts` in Excel for the web under **Automate → New Script**. Add workbook buttons for `queueCurrentForm`, `queueThresholdUpdate`, `clearCurrentForm`, `applyBrowseFilters`, `previousBrowsePage`, `nextBrowsePage`, and `initializeWbiRoleScreens`. `main` fills safe blank defaults and initializes the screen. Office Script buttons are attached in Excel by an authorized workbook editor.

For screenshot-style forms and paginated lists in Excel, use the Office.js add-in in `excel/office_addin/`. It supplies a task-pane form for Maintenance, Stock Position, Manufacturing BW and Manufacturing HB. Create the named Excel tables documented in [CLEAN_ARCHITECTURE.md](docs/CLEAN_ARCHITECTURE.md) on the matching tabs. Build with `npm install` and `npm run build`; sideload/deploy only after hosting the built files over trusted HTTPS and validating the manifest in the tenant.

### Google Sheets

Import each role workbook separately into Drive and convert each file to a Google Sheet. Add the seven `.gs` modules from `google_sheets/apps_script/` to each spreadsheet as a bound Apps Script project, save, authorize it, and reload. Apps Script combines those modules into a shared project runtime. The **WBI Operations** menu provides default values, dropdown validation, form queue actions, list refresh, and browse pagination.

Create a Google service account with Sheets API access, share each spreadsheet with it, and set `GOOGLE_APPLICATION_CREDENTIALS` plus `WBI_GOOGLE_MANAGER_SPREADSHEET_ID`, `WBI_GOOGLE_STOCK_MONITOR_SPREADSHEET_ID`, and `WBI_GOOGLE_OPERATORS_SPREADSHEET_ID`. The publisher verifies each spreadsheet has exactly the tabs required for its role before writing its batched ranges.

### Form queues and account sync

The spreadsheet scripts validate fields, add safe defaults, show inline errors, and stage requests in the active screen's `AS:BA` queue block. The workbook never stores an API token and never sends API writes directly. The Python submitter is dry-run-only unless `--commit` is supplied.

For Excel, download the role workbook with pending rows and preview them:

```bash
python shared/wbi_submit_queue.py --platform excel --file excel/workbooks/WBI_Manager.xlsx
```

For Google Sheets, select one role workbook:

```bash
python shared/wbi_submit_queue.py --platform google --role manager
```

Once reviewed, pass `--commit` with an API identity authorized for those specific endpoints. Failed submissions are marked `ERROR` with a short reason in the queue and written to the log. After adding or changing login users, run `python shared/wbi_submit_queue.py --platform google --sync-role-users` to refresh all configured Google role sheets, or run the command on each downloaded Excel role workbook. Only active account display names are copied to Operator and Stock Monitor dropdown lists; the Manager account list retains role, active state, and phone as required by the Admin screen.

## Roles and source API limits

The screen lists above follow your latest explicit workbook request. The original business reference also documents API permissions that remain enforced by WBI-MMS:

- Stock Monitor can read stock positions but is read-only for stock movements.
- Maintenance writes and Audit Log reads are Dev-only in the supplied API matrix. Those requested tabs remain in the specified files; a queued request may receive an authorization error when the WBI token does not have the source permission.
- Manager is authorized for inquiries and admin lists; contact details and login-user mobile numbers are kept only in the restricted Manager file and local SQLite snapshot.
- Passkey summaries are placeholders. The supplied API reference does not specify a safe export endpoint, so this project never fetches credential IDs, public keys, or authentication secrets.
- No onboarding identity data (Aadhaar, address, emergency contact), OTPs, tokens, passwords, or passkeys are included.

The source API is authoritative. A visible worksheet or button cannot grant an API permission. Permission failures are shown inline/toast in the spreadsheet or in the queue result; the package does not bypass backend role checks.

## SQLite and Drive storage

`data/schema/001` models the WBI operational entities, `002` defines refresh metadata, `003` records source-grounded choices, and `004` adds the explicit user starter values. Runtime API snapshots are generated from the column contract in `shared/wbi_common.py` and replaced in one SQLite transaction. The file can be placed in a synced Drive folder by setting `WBI_SQLITE_DB` to an absolute path, but it remains a local single-writer database. Do not have multiple machines refresh or write the same synced `.db` concurrently; allow Drive synchronization to finish before another device opens it.

## Tests

Run the offline suite with:

```bash
python -m unittest discover -s tests -v
```

It checks API normalization, validation flags, SQLite schema and rollback, the exact role workbook tab maps, helper/queue layout, starter data, login dropdown privacy, and endpoint allowlisting. The tests use synthetic data and do not call WBI or cloud APIs.

The optional browser smoke test requires an imported Google Sheet, an authorized read-only Playwright browser state, and Chromium:

```bash
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
```

Set `WBI_SHEETS_UI_URL` and `PLAYWRIGHT_STORAGE_STATE` in a private environment, then run `pytest -m e2e`. It checks the Google Sheets shell and Apps Script menu. It is skipped when those variables are absent. Playwright does not validate the native Excel grid or Office Script button attachment.

## Research and source references

See [RESEARCH_AND_ARCHITECTURE.md](docs/RESEARCH_AND_ARCHITECTURE.md) for official Microsoft and Google product documentation, current licensing/limits caveats, deployment choices, WBI-specific constraints, Playwright fit, and relevant arXiv papers including SpreadsheetBench 2. The supplied source handoffs are preserved in `docs/` for traceability.
