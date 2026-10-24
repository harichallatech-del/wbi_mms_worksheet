# WBI MMS Clean Architecture and Packaging

This project keeps the role workbooks as the familiar spreadsheet surface and places platform-specific behavior in separate, replaceable adapters. Google Apps Script and Office.js are different runtimes; the `.gs` files do not execute in Excel, and the Office.js add-in does not execute in Google Sheets.

## Dependency direction

```text
Workbook UI / Apps Script / Office.js
                |
         application actions
     validation, pagination, queues
                |
       stable data contracts
     WBI API / normalized datasets
                |
  platform and storage adapters
  Sheets API, Graph, SQLite, XLSX
```

The WBI API remains authoritative for identity, authorization and writes. The sheet and add-in render forms, validate basic input and prepare records in the same `AS:BA` queue block. The existing Python queue submitter is the allowlisted integration boundary; it can preview queued requests before an authorized `--commit`.

## Architecture and design principles

| Principle or pattern | Applied in this package |
|---|---|
| Single responsibility | Apps Script files split menu, validation, form queues, paging, dashboards and utilities. Python modules separate extraction, normalization, persistence, publishing and submission. |
| Dependency inversion | Office.js application code depends on the generic `RecordRepository<T>` port. `OfficeTableRepository<T>` is the Excel adapter and can be replaced without changing the form or paging service. |
| Generic programming | `RecordRepository<T>`, `RecordService<T>` and `PaginatedQuery<T>` serve stock, production and maintenance records with one typed contract. |
| Object-oriented design | Repository and application service classes encapsulate Excel I/O, validation, search and paging; composition occurs in the task-pane entry point. |
| Adapter pattern | Sheets API, Excel Graph, SQLite and Office.js isolate platform-specific reads/writes from the shared data contract. |
| Strategy/configuration | Role tab maps and per-screen field definitions select the correct workbook view and form behavior. |
| Composition root | `src/taskpane.ts` binds the active worksheet, screen definition, repository and application service. |
| Fail closed | Required source reads stop a refresh; queue writes are allowlisted and dry-run unless `--commit` is explicitly supplied; backend permissions remain in force. |
| Least privilege and privacy | No real logins, passwords or passkeys are seeded. Workbook selection and buttons do not grant API rights. |

## Role workbooks

| Workbook | Required visible screens |
|---|---|
| Manager | Dashboard, Stock Dashboard, Stock Position, Admin Settings, Audit Log, Inquiries |
| Stock Monitor | Stock Dashboard, Stock Positions |
| Operators | Manufacturing BW, Manufacturing HB, Maintenance |

The workbook builder and role map preserve these tab lists. Support data and pending form queues are stored in helper columns to the right of the visible screen layout.

## Google Sheets package

The bound script is divided into `.gs` modules in `google_sheets/apps_script/`. Apps Script combines files in the same project into one global runtime, so shared entry-point names remain global. Add all seven modules to each converted Google Sheet. Do not add an old monolithic copy alongside these modules. The WBI Operations menu provides validation, defaults, screen rendering, queued forms and client-side page controls.

## Microsoft 365 Excel package

`excel/office_scripts/WBI_Operations.ts` retains workbook-button actions and queue preparation. `excel/office_addin/` is the Office.js extension for task-pane forms and paginated tables. It reads records from named Excel tables and stages new requests in `AS:BA`; an authorized workbook editor must create a table on each supported sheet and use the table name shown here:

| Worksheet | Table name |
|---|---|
| Maintenance | `tblMaintenance` |
| Stock Position | `tblStockPositions` |
| Manufacturing BW | `tblManufacturingBW` |
| Manufacturing HB | `tblManufacturingHB` |

The add-in is a UI adapter: it stages forms in the existing `AS:BA` request queue and never calls the WBI API. Use the secured queue workflow for API writes. Run `npm install` and `npm run build` inside `excel/office_addin/` to build the task-pane assets. For local sideloading, serve the built files over trusted HTTPS, update the manifest's localhost origin for the chosen host, and sideload `manifest.xml` in Excel. Tenant deployment, HTTPS hosting, Microsoft 365 policy and supported Office.js requirements must be configured by the tenant administrator.

## Data and security boundaries

- Reference choices contain the supplied wire products, operators and machines, plus stock material and status values already represented by the source workbook. They are defaults pending confirmation against the live WBI master.
- User names, passwords, passkeys and authentication secrets are never fabricated or exported.
- The screenshot mockups guide screen labels, summary cards, record forms and paginated lists. Excel's Office.js task pane is a side panel hosted by Excel; it cannot replace the workbook chrome or turn the grid into a standalone web application.
- Maintenance and audit access can be role-restricted by the WBI API. A visible tab or local control does not override that restriction.
- The current Excel task pane covers maintenance, stock movement, and BW/HB production forms. Manager dashboards, Admin Settings, Audit Log and Inquiries remain in their requested role workbooks and existing Apps Script/Office Script queue workflows; they are not yet implemented as task-pane screens.

## Packaging

The distributable ZIP contains role `.xlsx` templates, platform scripts and add-in source, reference database/schema, deployment and research documents, and build source. Local credentials, `.env`, runtime logs, virtual environments and `node_modules` must stay outside the archive. Build the Office.js bundle after extracting the source package.
