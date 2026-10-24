# Bound Apps Script modules

Add every `.gs` file in this folder to the bound script project for each converted role workbook. Apps Script exposes top-level functions across project files, so the WBI menu can call the shared form, validation, paging and dashboard functions.

| File | Responsibility |
|---|---|
| `WBI_Config.gs` | Shared column positions, capacity, page size and starter choices |
| `WBI_Menu.gs` | `onOpen`, menu entries and role-screen initialization |
| `WBI_Validation.gs` | Dropdown validation and safe form defaults |
| `WBI_FormQueue.gs` | Field validation, queue creation and form reset |
| `WBI_Pagination.gs` | Search/filter/page rendering for record lists |
| `WBI_Dashboards.gs` | Dashboard, stock dashboard and admin reference-list rendering |
| `WBI_Utilities.gs` | Date/number conversion and inline error handling |

Keep the sheet queue as a staging area only. The script does not store API credentials or submit API writes. Use `shared/wbi_submit_queue.py` for preview and the allowlisted, authorized write path.
