# Research and Architecture Notes

Research checked 21 October 2026. Prefer the linked vendor documentation for final tenant-specific availability, limits, and pricing; these can change.

## Executive recommendation

Use Excel when WBI's analysts need Python calculations directly in a workbook, the company already uses Microsoft 365, or the application data lives in OneDrive/SharePoint. Use Google Sheets when collaboration and lightweight sheet-native UI are the priority and the team wants to own Python as a separate Cloud Run service. For a WBI production workflow with real integrations, either spreadsheet should remain a presentation/collaboration surface; run Python extraction and validation outside the workbook and calculate official KPI definitions deterministically.

| Requirement | Recommended path | Reason / constraint |
|---|---|---|
| Explore production data with Python in cells | Python in Excel | Curated Python runtime and libraries are available in Microsoft Cloud, but there is no network or local file access from the Python cell. |
| Automate workbook actions and Microsoft workflow | Office Scripts + Power Automate | TypeScript-based workbook automation with Microsoft workflow triggers. Business-license requirements and execution limits apply. |
| Programmatically update Microsoft 365 workbook | Python + Microsoft Graph file operations | This package writes a prepared XLSX file to OneDrive for Business through Graph; app registration and least-privilege permissions are required. Graph Excel object APIs are an alternative for delegated workbook-level operations. |
| Add menus, sidebar, custom function, or trigger in a shared sheet | Google Apps Script | Runs on Google's servers but uses JavaScript, not Python, and has per-execution quotas. |
| Python app reading/writing Google Sheets | Python + Sheets API v4 | Google publishes Python client libraries; service account or OAuth access must be configured and the spreadsheet shared appropriately. |
| Longer Python pipelines, custom packages, external APIs | Python service/job + spreadsheet API | A full cloud runtime allows normal Python dependencies and network integrations; treat cloud runtime and API calls as billable/quotas-aware services. |

## Vendor feature check

### Microsoft 365 Excel

- **Python in Excel availability and limits:** Microsoft documents it for qualifying Microsoft 365 business/enterprise subscriptions, including Excel on the web; supported desktop channels and platforms vary. Paid qualifying subscriptions include standard compute with a limited monthly premium-compute allowance; the Python in Excel add-on provides more premium compute and calculation modes. Device-based and shared-computer activation subscriptions are not supported. Verify current licensing for the actual tenant before rollout. [Availability and licensing](https://support.microsoft.com/en-gb/excel/python/python-in-excel-availability)
- **Runtime and libraries:** Python formulas execute in secure Microsoft Cloud containers with a curated Anaconda library set including common analysis libraries. Microsoft says Python has no network access, no local-file or account-token access, and can read workbook cells through `xl()` or external data brought in via Power Query. This makes it a strong analysis surface and a poor general-purpose automation host. [Data security](https://support.microsoft.com/en-us/excel/python/data-security-and-python-in-excel), [available libraries](https://support.microsoft.com/en-us/excel/python/open-source-libraries-and-python-in-excel), [getting started and external data](https://support.microsoft.com/en-us/excel/python/get-started-with-python-in-excel)
- **Office Scripts:** TypeScript scripts can be created in Excel, shared, and run from workbook buttons. Power Automate can execute them in larger workflows; Microsoft's current docs require a business Microsoft 365 license. Limits include 5 MB request/response, five million cells per workbook-script range call, 1,600 Run script calls per user/day, and a 120-second synchronous Power Automate operation timeout. Script scheduling is temporarily disabled in the cited overview; use a Power Automate scheduled flow. [Overview](https://learn.microsoft.com/en-us/office/dev/scripts/overview/excel), [Power Automate](https://learn.microsoft.com/en-us/office/dev/scripts/develop/power-automate-integration), [platform limits](https://learn.microsoft.com/en-us/office/dev/scripts/testing/platform-limits)
- **Microsoft Graph:** Graph can read/update workbook objects in OneDrive for Business and SharePoint/Group drives using REST; its Excel REST API supports Office Open XML workbooks and not consumer OneDrive. This package creates a workbook session and patches only the role workbook's helper ranges. Application permissions, admin consent, storage location, tenant policy, and service-principal scope require IT review. [Excel resource](https://learn.microsoft.com/en-us/graph/api/resources/excel), [Graph API billing overview](https://learn.microsoft.com/en-us/graph/metered-api-overview)
- **Python libraries outside Excel:** `requests` handles the WBI and Graph REST calls; `openpyxl` is used only to read and update queued form rows after a user enters them. The three starter `.xlsx` files are generated with the spreadsheet artifact runtime, not by `openpyxl`. Cloud hosting and Microsoft Graph application permissions are separate from Python in Excel licensing.

### Google Sheets

- **Apps Script:** JavaScript-based scripts can add custom menus, dialogs, sidebars, custom functions, and web apps; the scripts are stored in Drive and run on Google's servers. Apps Script is suitable for lightweight sheet-native UX and simple event automation, not for native Python. [Apps Script overview](https://developers.google.com/apps-script/overview), [extending Sheets](https://developers.google.com/apps-script/guides/sheets)
- **Quotas:** Google currently documents six minutes maximum execution per Apps Script run, with account-specific daily and service quotas that may change. Design batch operations, avoid one API call per cell, and monitor execution failures. [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
- **Sheets API and Python:** The Google Sheets API has an official Python quickstart and client library. Current documented limits are 300 read/write requests per minute per project and 60 per minute per user per project; requests processing over 180 seconds time out. Google's guidance recommends payloads around 2 MB for performance. The standard API is currently described as no additional cost within quotas; the same page notes planned charges for quota overages later in 2026, so check current billing terms before a production rollout. [Python quickstart](https://developers.google.com/workspace/sheets/api/quickstart/python), [API limits and pricing notes](https://developers.google.com/workspace/sheets/api/limits), [Python client libraries](https://developers.google.com/workspace/sheets/api/guides/libraries)
- **Cloud Python:** Cloud Run can deploy Python services or jobs with standard Python packages; it requires a Google Cloud project, enabled services, and billing configuration. Compute cost depends on workload, region, CPU/memory, and request/job pattern. [Python service deployment](https://docs.cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-python-service), [Cloud Run Python runtime](https://docs.cloud.google.com/run/docs/runtimes/python)
- **Authentication:** Google API access uses OAuth scopes. Sheets scopes grant file-level spreadsheet access, not per-tab access; use protected ranges for cell editing controls, and keep credentials outside the workbook. [Sheets API scopes](https://developers.google.com/workspace/sheets/api/scopes)

## Suggested WBI production architecture

```text
WBI-MMS REST API (read-only role)
             |
   shared Python extractor
   pagination + validation
             |
   normalized row model
         /       \
 OneDrive XLSX    Google Sheets API
  Graph upload    atomic batch update
         \       /
 same dashboard tabs and KPI definitions
```

1. Keep the backend API as the source of truth for role access, derived stock levels, and OEE. Do not query PostgreSQL directly for this dashboard. The supplied reference does not define a read-only role; request the least-privileged API identity available and verify its permissions with the backend owner.
2. Extract all required pages and lookups, check response shape, normalize fields, and only then update the destination. Authentication errors on required sources stop refresh; role-gated audit, maintenance, inquiries, and login-user reads are optional so a 403 does not block unrelated screens. The supplied WBI reference documents OTP/passkey user authentication but no unattended service-token flow, so scheduled refresh requires an approved auth/rotation design from the backend owner.
3. Keep inquiry contact details and login-user phone numbers only in the manager's restricted workbook/SQLite snapshot. The inquiry view does not export email, company, or message fields. Audit detail redacts phone, address, email, Aadhaar, OTP, and passkey-like keys. No passkey credentials or operator-onboarding identity fields are queried. Keep API JWT and cloud credentials in a secret manager. Prefer a dedicated reporting identity and minimum workbook scopes.
4. Keep KPI logic deterministic and documented. Cross-check daily production, record counts, stock levels, and OEE against WBI-MMS before using for operational decisions.
5. Add refresh monitoring and alert if last successful refresh exceeds the agreed SLA. Agree plant timezone and daily cutoff with operations before comparing dates.
6. Move high-volume history to a database/warehouse and keep the workbook as an aggregate layer when spreadsheet row volume or refresh latency becomes material.

## WBI-specific implementation choices

- **SQLite snapshot mirror:** the shared publisher persists a normalized API snapshot to a local `.db` file in a transaction before publishing. Sheet-shaped snapshot tables are generated from `wbi_common.TABLES`; separate SQL files define the app-aligned operational core, refresh metadata, and source-grounded starter reference choices. The included database has only starter lookups, not production or user records. Its runtime snapshot may contain manager-restricted inquiry name/phone and login-user phone fields; store the file only in restricted storage. Email, company, message, passkey credentials, OTPs, and operator-onboarding identity are omitted.

- **BW and HB normalize to one logical shape but remain on separate tabs.** The reference describes different BW/HB entity joins and one inconsistent BW UI/API payload. The refresh scripts only read list endpoints and do not write to manufacturing endpoints.
- **Stock levels come from `/stock-levels`.** Do not sum stock-position rows as a proxy for on-hand inventory unless the business confirms they are additive movements. Current documentation says backend sums active weights, which could overstate physical on-hand if users enter snapshots.
- **OEE is passed through from `/dashboard/oee`.** This avoids an unverified recalculation across potentially missing start/end, good-weight, and ideal-rate fields. Verify response field names and units against the live backend before use; source contracts in the reference are not live introspection.
- **Dashboard date criteria depend on numeric dates.** The common extractor converts ISO date strings to the shared Excel/Google Sheets serial calendar. Set the plant timezone/date-boundary convention before routine daily comparisons.
- **Capacity:** the template supports up to 2,000 records per tab. The extractor fails rather than silently truncating; narrow date filters or expand workbook ranges and `DATA_CAPACITY` together.
- **Three role files:** Manager has Dashboard, Stock Dashboard, Stock Position, Admin Settings, Audit Log, and Inquiries; Stock Monitor has Stock Dashboard and Stock Positions; Operators has Manufacturing BW, Manufacturing HB, and Maintenance. Reference, data, and queue ranges live to the right on those same screens, not on additional visible tabs. This is a user-interface and sharing boundary; workbook cell/tab visibility is not a security control.
- **Cloud refresh:** the Microsoft publisher patches support ranges through Graph Excel REST; the Google publisher writes matching ranges with the Sheets API. Google requires three separate imported spreadsheets and IDs. The included XLSX files are local templates; no cloud files or credentials are created by the ZIP.
- **Role caveats from the source API matrix:** Stock Monitor has read access to stock positions. Maintenance write and Audit Log read are Dev-only; the user-requested tabs remain in their specified workbooks, but queued requests can receive a permission error unless the submitting WBI identity has the documented role. Do not bypass backend authorization.

## Academic and independent research

These papers inform design choices; they are not evidence that this dashboard implementation improves WBI factory performance.

1. **SpreadsheetBench: Towards Challenging Real World Spreadsheet Manipulation (2024).** Built from 912 real Excel forum questions and reports a substantial gap between then-current LLM performance and human performance. Practical implication: use deterministic calculations, inspect the actual workbook model, and verify AI-generated spreadsheet edits. [arXiv:2406.14991](https://arxiv.org/abs/2406.14991)
2. **SpreadsheetBench 2: Evaluating Agents on End-to-End Business Spreadsheet Workflows (2026).** Evaluates generation, debugging, and visualization on 321 multi-sheet business tasks. Its reported best overall task accuracy is 34.89%, with debugging accuracy of 12%. This supports keeping LLMs as reviewed assistants rather than unattended KPI or workbook editors. [arXiv:2606.29955](https://arxiv.org/abs/2606.29955)
3. **Large Language Models for Spreadsheets: Benchmarking Progress and Evaluating Performance with FLARE (2025).** Proposes spreadsheet formula, audit, reasoning, and manipulation evaluations; the preprint reports that performance degrades on complex multi-step spreadsheet logic. Treat its findings as a preprint, not a vendor certification. [arXiv:2506.17330](https://arxiv.org/abs/2506.17330)
4. **Adaptive Data Quality Scoring Operations Framework using Drift Monitoring (2024).** Presents a data-quality scoring and drift-monitoring workflow evaluated in an industrial steel process use case. Practical implication: monitor refresh timeliness and input distributions, and review changing process conditions rather than assuming fixed thresholds are universally valid. [arXiv:2408.06724](https://arxiv.org/abs/2408.06724)

## App-style forms and pagination: current implementation

The latest workbook adds dedicated form tabs, input validation, helper text and readiness messages, dynamic lookup lists refreshed with operational data, queue-based create/update/delete actions, and filtered page views for production, stock, maintenance, and reference records. A single shared field model and source data design is used across Excel and Google Sheets, while each platform has its own user-interface adapter: Office Scripts buttons for Excel and a bound Apps Script menu for Sheets. Scripts stage actions locally; the Python submitter is the credentialed network boundary.

The design follows platform capabilities. Microsoft documents cell-level data validation and Office Scripts buttons, with button association performed by the user in Excel. Google Sheets supports validation rules, bound custom menus, and image/drawing click handlers; Apps Script can also host HTML dialogs or sidebars when a true multi-control form is needed. A larger production app should use a dedicated web form or add-in/sidebar for complex dependent fields and role-aware UX, while retaining the same API contract and server-side checks.

Research supports a few practical safeguards. The 2026 CRAFT preprint studies template-aware spreadsheet form filling and reports better slot grounding when writable cells are constrained and revalidated; that suggests protecting labels, preserving template structure, and validating field-to-cell mappings. Microsoft Research’s 2022 study on spreadsheet data structuring notes the value users place on flexible grids while finding table columns useful for validation and other operations. Spreadsheet QA research also emphasizes structured checks and explicit error feedback. These papers inform the interaction design; they do not validate this WBI workbook in a live plant environment.

Sources: [Excel data validation](https://support.microsoft.com/en-us/excel/get-started/apply-data-validation-to-cells), [Office Scripts overview](https://learn.microsoft.com/en-us/office/dev/scripts/overview/excel), [Office Script buttons](https://learn.microsoft.com/en-us/office/dev/scripts/develop/script-buttons), [Google Sheets custom menus](https://developers.google.com/apps-script/guides/menus), [Apps Script dialogs and sidebars](https://developers.google.com/apps-script/guides/dialogs), [Google Sheets validation and UI extensions](https://developers.google.com/apps-script/guides/sheets), [CRAFT (arXiv:2610.04437)](https://arxiv.org/abs/2610.04437), [Spreadsheet QA survey](https://doi.org/10.1016/j.jss.2014.03.058), [Microsoft Research, CHI 2022](https://www.microsoft.com/en-us/research/publication/its-freedom-to-put-things-where-my-mind-wants-understanding-and-improving-the-user-experience-of-structuring-data-in-spreadsheets/).

## Test strategy and Playwright fit

The package now separates deterministic tests from optional browser smoke coverage. Unit/integration tests use synthetic API records, isolated temporary SQLite files, and mocks; they verify data normalization, formulas' input contract, schema integrity, transaction rollback, workbook XML validations, and write-queue endpoint safety without making network calls. This follows pytest's fixture and parameterization model when teams choose pytest as the runner; the included base suite remains runnable with Python's standard `unittest`.

Playwright is included as an optional end-to-end smoke test for an imported Google Sheet, using an explicitly supplied signed-in storage-state file and read-only checks for the sheet shell and bound Apps Script menu. Its official Python guide recommends the Pytest plugin for E2E testing and supports Chromium, Firefox, and WebKit. Playwright is not used to claim coverage of native Excel controls: an `.xlsx` has no hosted web UI, Office Script buttons are user-associated in Excel, and spreadsheet grids are not ordinary DOM forms. Testing Excel's worksheet controls still requires Excel in a supported tenant. [Playwright Python introduction](https://playwright.dev/python/docs/intro), [Playwright Pytest runner](https://playwright.dev/python/docs/test-runners), [pytest fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html).

SQLite checks use both `PRAGMA integrity_check` and `PRAGMA foreign_key_check`, because SQLite documents that the integrity check does not report foreign-key violations. Snapshot replacement runs in a transaction so a failed insert rolls back to the previous committed snapshot. [SQLite PRAGMA documentation](https://www.sqlite.org/pragma.html), [SQLite transactions](https://www.sqlite.org/lang_transaction.html).

## Cost and licensing caveats

- Existing Microsoft 365 or Google Workspace subscriptions do not automatically include every automation, premium compute, cloud runtime, or add-on right. Verify tenant SKUs and admin policy.
- Python in Excel premium compute/add-on, Power Automate rights, cloud runtime usage, API quotas, and identity management are separate considerations.
- This project does not estimate a bill: prices and entitlements depend on tenant, geography, cloud region, deployment frequency, concurrency, and storage.
- Standard Google Sheets API usage is currently stated as no additional cost within quota; the official quota page records planned later-2026 charges for over-quota usage. Treat cost language as time-sensitive.
