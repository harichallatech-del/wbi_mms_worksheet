# WBI Manufacturing Management System: Business and Data Reference

**Purpose:** Source-grounded explanation of the business workflows, screens, UI field names, APIs, services, and PostgreSQL entity/table names. It also gives a build specification for Microsoft Excel and Google Sheets dashboards and their Python refresh scripts. This document is the deliverable; it does not create or run the dashboards or scripts.

**System in scope:** The root README identifies `reactjs-frontend-v1/` as the React application and `nestjs-backend/` as the NestJS API. `reactjs-frontend/` is a separate prototype and is not included in the screen count below.

## 1. Business Overview

Wire Bind Industries uses WBI-MMS to record production and stock movements for Binding Wire (BW) and HB manufacturing, monitor shift/machine/operator performance, manage reference data and user access, and maintain operational records. The production records store produced weight plus optional downtime and quality/scrap fields. Stock position records capture dated, timed raw-material weights; thresholds produce low/over-stock alerts.

The browser application is a role-based single-page application. It calls a NestJS REST API under `/api`, which uses TypeORM with PostgreSQL in the `public` schema. The backend configuration currently enables TypeORM schema synchronization; see the data cautions in section 9.

## 2. Screen Count and Access

Count convention: the app has **10 top-level navigation destinations**. The Dashboard destination has two role-specific implementations, so there are **11 distinct tab-content screens**. Including Login and conditional Operator Onboarding gives **13 full-page screen components/states**. Admin Settings has six nested tabs; these are counted as subviews, not additional top-level destinations. Passkey onboarding and passkey management are modal workflows, not full-page screens.

| Top-level screen | Component / contents | Access in navigation | Main fields, data, and actions |
|---|---|---|---|
| Dashboard (manager/dev) | `Dashboard` | dev, manager | KPIs: stock item count/weight, today's BW/HB production weight and record count, active operators/users. Live Activity list; production by day/night shift; top operators; machine OEE table (machine, records, downtime, availability, quality, optional performance, OEE); production trend; low-stock alerts. Refresh/retry/error states. |
| Dashboard (operator) | `OperatorDashboard` | operator | Today's BW/HB weight and records, total today, total records, day/night split, BW/HB shift split, latest merged BW/HB activity (date, operator, machine, shift, product, weight, status), refresh/retry. |
| Stock Dashboard | `StockDashboard` | dev, stock-monitor | Materials tracked; current stock kg; reorder-alert count; today's movement kg; per-material current/min/max/status; recent movement item/date/time/weight; refresh. |
| Stock Position | `StockPosition` + `StockForm` + `StockTable` | dev, manager, stock-monitor | Search by item/date; paged table: S.No, Date, Raw Material, Weight (kg), Time, Actions. Add/edit fields: Date, Raw Material, Weight (kg), Time. Threshold editor fields: min/max level per raw material; available for managers/devs. Delete and pagination. |
| Manufacturing BW | `ManufacturingBW` + form/table | dev, manager, operator | Search by operator/date; filters include date range, operator, machine, shift; paged records. Table: S.No, Date, Operator, Machine, Shift, Product, Status, Weight Produced (kg), Downtime, Good/Scrap (kg), Quality, Actions. Add/edit fields: Date; Operator; Machine; Shift; Product; Status; Weight Produced (kg); Start Time; End Time; Downtime (min); Downtime Reason; Good Weight (kg); Scrap Weight (kg); Rejection Reason; Needs Rework. |
| Manufacturing HB | `ManufacturingHb` + form/table | dev, manager, operator | Search by operator; date/operator/machine/shift filters and paging. Table columns match BW. Add/edit fields match BW: Date, Operator, Machine, Shift, Product, Status, Weight Produced (kg), Start Time, End Time, Downtime (min), Downtime Reason, Good Weight (kg), Scrap Weight (kg), Rejection Reason, Needs Rework. |
| GI / Legend | `Legend` | dev, manager | Search by product/operator/machine; table: Product, Type, Status, HB Operator, BW Operator, GI Operator, Shift, Machine, Actions. Form fields: Product Name, Product Type (BW/HB/GI), Product Status, Machine, HB Operator, BW Operator, GI Operator, Shift. Includes a color reference guide. **Current data is mock/local frontend data, not a persisted backend feature.** |
| Admin Settings | `AdminSettings` with six nested tabs | dev, manager | Tabs: Status, Products, Operators, Machines, Login Users, Passkeys. Fields detailed in section 3. CRUD/deactivation actions according to tab. |
| Maintenance | `MachineMaintenance` | dev only | Filters by date range, planned/unplanned, machine; table: S.No, Date, Machine, Type, Description, Downtime (min), Cost, Performed By, Actions. Add/edit: Machine, Date, Type (planned/unplanned), Downtime (minutes), Cost (₹), Performed By, Description. |
| Audit Log | `AuditLog` | dev only | Filter by entity type; fetch recent entries with configurable limit. Table: Time, User, Action, Entity, Record ID, Details (before/after JSON data). Read-only. |
| Inquiries | `ContactInquiries` | dev, manager | Search name/phone/product/company; table: #, Name/Phone, Product, Quantity, Source, Status, WhatsApp, Date, Actions. Status actions: new/contacted/quoted/closed; mark WhatsApp sent; details include email, company, message. |
| Login | `Login` | unauthenticated | Mobile Number is the account identifier. Sign in with Passkey or QR Code; QR flow indicates whether the account is new/existing. No OTP-entry field appears in this screen. |
| Operator Onboarding | `OperatorOnboarding` | operator only when profile missing | Required: Full name, Aadhaar number, Address. Optional: Aadhaar card image/file name, Father/guardian name, Date of birth, Alternate phone, Emergency contact name, Emergency contact phone, Notes/onboarding remarks. Sensitive identity fields; exclude from analytics exports. |

### Role-visible destinations

| Role value | Label | Destinations |
|---|---|---|
| `dev` | Dev User | All 10 navigation destinations |
| `manager` | Manager | Dashboard, Stock Position, Manufacturing BW, Manufacturing HB, GI, Admin Settings, Inquiries |
| `operator` | Machine Operator | Operator Dashboard, Manufacturing BW, Manufacturing HB |
| `stock-monitor` | Stock Operator | Stock Dashboard, Stock Position |

The app checks an operator profile after authentication and blocks access to the regular app shell until onboarding is complete. Users created through QR self-registration start with the least-privileged `operator` role; a manager/dev assigns other roles in Login Users.

## 3. Admin Settings Fields

| Nested tab | UI input names/labels | Stored/returned names |
|---|---|---|
| Status | Status Name; Description (Optional) | `status_id`, `name`, `status_code`, `description`, `is_active` |
| Products | Product Name; Description (Optional) | `product_id`, `name`, `product_code`, `description`, `is_active` |
| Operators | Type (HB/BW); Operator Name | `operator_id`, `name`, `type`, `employee_code`, `phone`, `full_name`, `is_active` |
| Machines | Type (HB/BW); Machine Name; Location (optional) | `machine_id`, `name`, `type`, `location`, `machine_code`, `ideal_rate_per_hour`, `is_active` |
| Login Users | Name; Mobile Number; Role; Active login toggle | `auth_user_id`, `name`, `phone`, `role`, `is_active` |
| Passkeys | Device name (optional); device/passkey list and revoke actions | `passkey_id`, `name`, `device_type`, `backed_up`, `transports`, `last_used_at`, `created_at`; admin view also joins account name/phone/role |

## 4. Business Data and Field Semantics

### Production record

BW and HB records have a shared reporting shape: `manufacturing_id`, `date`, `operator`, `machine`, `shift`, `product`, `status`, `weight_produced`, `start_time`, `end_time`, `downtime_minutes`, `downtime_reason`, `good_weight`, `scrap_weight`, `rejection_reason`, `rework_flag`, and calculated/returned `quality_percent`. Weights are in kg; times are local plant times. The forms require date, operator, machine, shift, product, and positive produced weight; downtime and quality/scrap fields are optional.

The form's lookup controls use IDs internally (`operator_id`, `machine_id`, `shift_id`, `product_id`) but the backend create/update services accept display values (`operator_name`, `machine_name`, `shift_name`, `product_name`, `status_name`) along with `calendar_date`. Store normalized IDs in any external dashboard dataset, while retaining display names for pivots.

The current form reason choices are:

- Downtime: Breakdown; Setup / Changeover; Material Shortage; No Operator; Maintenance; Power Cut; Other.
- Rejection: Tensile Fail; Dimensional; Surface Defect; Coating Defect; Other.

### Inventory record and current level

Stock movement/position record: `stock_position_id`, `raw_material_id`, date/time dimension keys, `weight`, and soft-delete timestamp. API/UI view fields are `date`, `item` (raw material name), `weight`, and `time`. Current stock level and low/over status are derived by backend stock-level logic using material thresholds. `min_level` and `max_level` are kg thresholds; null means not configured.

### Inquiry

Fields: `inquiry_id`, `name`, `phone`, `email`, `company`, `product`, `quantity`, `message`, `status`, `source`, `whatsapp_sent`, `created_at`, `updated_at`. Status values: `new`, `contacted`, `quoted`, `closed`. Source values: `contact_form`, `product_catalog`, `landing_page`.

### Dashboard calculations already implemented

- Production totals: sum `weight_produced`; BW and HB remain separate measures, although operator summary also presents their combined daily total.
- Current stock: aggregate recorded stock weight by raw material; low/over alerts compare current weight with configured `min_level`/`max_level`.
- Availability: `(planned_minutes - downtime_minutes) / planned_minutes`; records lacking start/end times do not contribute planned time.
- Quality: `good_weight / produced_weight`; missing good weight is treated as produced weight in OEE aggregation.
- Performance: produced kg divided by `(runtime_hours * ideal_rate_per_hour)` when a machine ideal rate exists; capped at 100%.
- OEE: availability × quality × performance; performance defaults to 1 in the OEE product when not available. Display is percentage.

## 5. API Catalogue

All routes below are prefixed `/api`. JSON routes use the frontend request helper; authenticated routes send the stored bearer token. Role labels refer to the `auth_users.role` enum.

| Method and path | Purpose / important parameters | Access |
|---|---|---|
| `POST /auth/request-otp` | Body: `phone`; issue one-time code | Public |
| `POST /auth/verify-otp` | Body: `phone`, `otp`, optional `role`; verify and return token/user | Public |
| `POST /auth/dev-login` | Body: `phone`, `role`, `name`; development shortcut | Public route; disabled unless server config enables it |
| `GET /auth/passkeys/config` | WebAuthn RP/origin configuration | Public |
| `POST /auth/passkeys/register/options` | Registration options; optional preferred authenticator type | JWT |
| `POST /auth/passkeys/register/verify` | Verify registration; credential response, optional `name`, `autoRegister` | JWT |
| `POST /auth/passkeys/authenticate/options` | Passkey authentication options | Public |
| `POST /auth/passkeys/authenticate/verify` | Verify passkey assertion and issue JWT | Public |
| `POST /auth/passkeys/qr/options` | Body includes mobile number; choose QR authentication vs registration | Public |
| `POST /auth/passkeys/qr/verify` | Verify cross-device QR sign-in | Public |
| `GET /auth/passkeys` | List caller's passkeys | JWT |
| `DELETE /auth/passkeys/:id` | Remove caller's passkey | JWT |
| `GET /auth/passkeys/admin` | List all passkeys with owning user info | dev, manager |
| `DELETE /auth/passkeys/admin/:id` | Revoke any user's passkey | dev, manager |
| `GET /dashboard` | Summary, recent activity, shifts, operators, OEE, trend, low stock | dev, manager |
| `GET /dashboard/oee?days=` | Machine OEE; default 7, max 365 days | dev, manager |
| `GET /dashboard/trend?days=` | Production trend; default 7, max 90 days | dev, manager |
| `POST /manufacturing-bw` | Create BW record | dev, manager, operator |
| `GET /manufacturing-bw?page=&pageSize=&from=&to=&operator=&machine=&shift=` | Filtered/paginated BW records | dev, manager, operator |
| `PUT /manufacturing-bw/:id` | Update BW record | dev, manager, operator |
| `DELETE /manufacturing-bw/:id` | Soft-delete BW record | dev, manager, operator |
| `POST /manufacturing-hb` | Create HB record | dev, manager, operator |
| `GET /manufacturing-hb?page=&pageSize=&from=&to=&operator=&machine=&shift=` | Filtered/paginated HB records | dev, manager, operator |
| `PUT /manufacturing-hb/:id` | Update HB record | dev, manager, operator |
| `DELETE /manufacturing-hb/:id` | Soft-delete HB record | dev, manager, operator |
| `POST /stock-positions` | Body: `raw_material_id` or `raw_material_name`, `date`, `time`, `weight` | dev, manager, stock-monitor |
| `GET /stock-positions?page=&pageSize=&from=&to=&item=` | Filtered/paginated stock history | dev, manager, stock-monitor |
| `GET /stock-levels` | Per-material current level, min/max, status | dev, manager, stock-monitor |
| `PUT /raw-materials/:id` | Body: optional `min_level`, `max_level` | dev, manager, stock-monitor |
| `PUT /stock-positions/:id` | Update material/date/time/weight | dev, manager, stock-monitor |
| `DELETE /stock-positions/:id` | Soft-delete stock record | dev, manager, stock-monitor |
| `GET /admin/status`; `POST/PUT/DELETE /admin/status[/id]` | Read or manage status lookup (`name`, `description`) | GET: all roles; writes: dev, manager |
| `GET /admin/products`; `POST/PUT/DELETE /admin/products[/id]` | Read or manage products (`name`, `description`) | GET: all roles; writes: dev, manager |
| `GET /admin/operators`; `POST/PUT/DELETE /admin/operators[/id]` | Read or manage operators (`name`, `type`) | GET: all roles; writes: dev, manager |
| `GET /admin/machines`; `POST/PUT/DELETE /admin/machines[/id]` | Read or manage machines (`name`, `type`, optional `location`) | GET: all roles; writes: dev, manager |
| `GET /admin/auth-users`; `POST/PUT/DELETE /admin/auth-users[/id]` | Manage login users (`name`, `phone`, `role`, `is_active`) | dev, manager |
| `GET /operator-info/me`; `POST /operator-info/me` | Read/upsert caller profile; includes identity/onboarding fields | operator |
| `GET /operator-info` | All operator profiles for management | dev, manager |
| `GET /machine-maintenance?page=&pageSize=&from=&to=&maintenance_type=&machine=` | Filter/paginate maintenance | dev |
| `POST /machine-maintenance` | Create maintenance record | dev |
| `PUT /machine-maintenance/:id` | Update maintenance record | dev |
| `DELETE /machine-maintenance/:id` | Soft-delete maintenance record | dev |
| `GET /audit-logs?limit=&entity_type=` | Recent audit entries; default limit 50 | dev |
| `POST /contact-inquiries` | Create inquiry; body includes `name`, `phone`, `product`, optional contact/message/source fields | JWT: dev, manager, operator, stock-monitor |
| `GET /contact-inquiries`; `GET /contact-inquiries/:id` | List/get inquiry | dev, manager |
| `PUT /contact-inquiries/:id/status` | Body: `status` | dev, manager |
| `PUT /contact-inquiries/:id/whatsapp` | Mark WhatsApp sent | dev, manager |

No backend `/legend` API is implemented. Do not use the Legend screen as a source for a production dashboard without replacing its mock data with a persisted API/table.

## 6. Services and Module Ownership

### Frontend services

| Frontend service/module | Business responsibility |
|---|---|
| `services/api.ts` | Shared stock, dashboard, inquiry clients; also currently holds mock Legend data |
| `services/manufacturing_bw_api.ts` | BW list/create/update/delete and reference-data calls |
| `services/manufacturing_hb_api.ts` | HB list/create/update/delete and ID-to-name lookup conversion |
| `services/admin-api.ts` | Status, product, operator, machine, and login-user CRUD |
| `services/maintenance_api.ts` | Maintenance CRUD/list filters |
| `services/audit_api.ts` | Audit-log query |
| `services/auth-api.ts` | OTP/dev login endpoints |
| `services/passkey-api.ts` | WebAuthn and QR sign-in/registration/passkey management |
| `services/operator-info-api.ts` | Operator self-profile and manager list |
| `services/request.ts`, `services/api-config.ts` | Bearer headers, session expiry behavior, API base URL (`VITE_API_BASE_URL` or `/api`) |

### Backend modules, controllers, and services

| Feature | Controller | Service | Module |
|---|---|---|---|
| BW production | `ManifacturingBwController` | `ManifacturingBwService` | `ManifacturingBwModule` |
| HB production | `ManufacturingHbController` | `ManufacturingHbService` | `ManufacturingHbModule` |
| Stock | `StockPositionController` | `StockPositionService` | `StockPositionModule` |
| Dashboard | `DashboardController` | `DashboardService` | `DashboardModule` |
| Admin reference/login users | `AdminSettingsController` | `AdminSettingsService` | `AdminSettingsModule` |
| Authentication | `AuthController` | `AuthService`, `SmsService` | `AuthModule` |
| Passkeys | `PasskeyController` | `PasskeyService` | `PasskeyModule` |
| Operator profile | `OperatorInfoController` | `OperatorInfoService` | `OperatorInfoModule` |
| Maintenance | `MachineMaintenanceController` | `MachineMaintenanceService` | `MachineMaintenanceModule` |
| Audit | `AuditLogController` | `AuditLogService` | `AuditLogModule` |
| Inquiries | `ContactInquiryController` | `ContactInquiryService` | `ContactInquiryModule` |

Cross-cutting backend pieces: `JwtAuthGuard`, `RolesGuard`, `Roles` decorator, request-context/logging middleware, transactional service base, and `audit.util.ts` for change history.

## 7. PostgreSQL Tables and Entity Names

Entity names below are declared in `nestjs-backend/src/modules/entities/v1/`. The app config targets PostgreSQL schema `public`. **Core production/stock tables and columns:**

| PostgreSQL table | Key columns and relationship notes |
|---|---|
| `manufacturing_bw` | `manufacturing_id`; FK `date_id`, `operator_id`, `machine_id`, `shift_id`, `product_id`, `status_id`; `weight_produced`; `start_time`, `end_time`, `downtime_minutes`, `downtime_reason`; `good_weight`, `scrap_weight`, `rejection_reason`, `rework_flag`; `created_at`, `updated_at`, soft-delete `deleted_at`. |
| `manufacturing_hb` | `manufacturing_id`; FK `date_id`, `operator_id`, `shift_id`, `product_id`, `machine_id`; optional `role_id`; `weight_produced`, string `status`; same downtime/quality fields as BW; `created_at`, `updated_at`, soft-delete `deleted_at`. |
| `stock_position` | `stock_position_id`; FK `raw_material_id`, `date_id`, `time_id`; `weight`; soft-delete `deleted_at`. |
| `raw_material` | `raw_material_id`, `raw_material_name`, nullable kg thresholds `min_level`, `max_level`. |
| `date_dim` | `date_id`, unique `calendar_date`. |
| `time_dim` | `time_id`, `time_value`. |
| `shift` | `shift_id`, `shift_name`, nullable `start_time`, `end_time`. |

**Admin/lookups and auth:**

| Table | Main columns |
|---|---|
| `auth_users` | `auth_user_id`, `name`, unique `phone`, enum `role` (`dev`, `manager`, `operator`, `stock-monitor`), `is_active`, `created_at`, `updated_at`. |
| `status_list` | `status_id`, unique `name`, optional `status_code`, `description`, `is_active`, timestamps. |
| `products_list` | `product_id`, unique `name`, optional `product_code`, `description`, `is_active`, timestamps. |
| `operators_list` | `operator_id`, `name`, optional `employee_code`, `phone`, enum `type` (`HB`/`BW`), `full_name`, `is_active`, timestamps. |
| `machine_list` | `machine_id`, `name`, enum `type`, optional `location`, unique `machine_code`, optional `ideal_rate_per_hour`, `is_active`, timestamps. |
| `passkeys` | `passkey_id`, `credential_id`, `public_key`, `user_id`, `counter`, `device_type`, `backed_up`, `transports`, `name`, `last_used_at`, timestamps. Credential ID is unique; user FK cascades on delete. |
| `otp_verifications` | `id`, `phone`, hashed `otp_hash`, `attempts`, `used`, `expires_at`. |
| `webauthn_challenges` | `challenge_id`, `challenge`, `type`, optional `user_id`, `expires_at`. |

**Operational/support tables:**

| Table | Main columns |
|---|---|
| `machine_maintenance` | `maintenance_id`; FK `machine_id`; `maintenance_date`, `maintenance_type` (`planned`/`unplanned`), `description`, `downtime_minutes`, `cost`, `performed_by`, timestamps, soft-delete `deleted_at`. |
| `operator_info` | `operator_info_id`, `auth_user_id`, `phone`, `name`, `address`, `aadhaar_number`, optional Aadhaar image/file name, guardian, DOB, alternate phone, emergency contact, notes, `is_active`, timestamps. Unique indexes on auth user, phone, Aadhaar. Highly sensitive. |
| `contact_inquiry` | `inquiry_id`, `name`, `phone`, optional `email`, `company`, required `product`, optional `quantity`, `message`, `status`, `source`, `whatsapp_sent`, timestamps. |
| `audit_log` | `audit_id`, `entity_type`, optional `entity_id`, `action`, JSONB `before_data`/`after_data`, optional `performed_by`, `created_at`. |

**Additional/legacy reference entities also present:** `operator`, `machine`, `product`, `status`, `role`, `machine_type`, `operator_role`, `machine_type_map`, `product_status`, and `product_status_map`. The singular BW lookup entities are distinct from the newer plural/list entities used by HB and admin workflows. Confirm which records are canonical before joining the systems or building cross-line reference dimensions.

## 8. Excel / Google Sheets Dashboard Build Specification

The workbook and Google Sheet should use the same logical sheet/tab model. Suggested sheets are specifications, not existing files.

| Sheet/tab | Purpose and recommended columns |
|---|---|
| `Dashboard` | Date range and line filters; KPI values for BW kg, HB kg, total kg, record count, good kg, scrap kg, quality %, downtime minutes, OEE %, stock kg, low-stock count; daily production trend, BW/HB split, day/night split, top operators, machine OEE, low-stock list. |
| `Production_BW` | `manufacturing_id`, `date`, `operator_id`, `operator`, `machine_id`, `machine`, `shift_id`, `shift`, `product_id`, `product`, `status`, `weight_produced_kg`, `start_time`, `end_time`, `downtime_minutes`, `downtime_reason`, `good_weight_kg`, `scrap_weight_kg`, `rejection_reason`, `rework_flag`, `quality_percent`, `created_at`. |
| `Production_HB` | Same reporting columns as `Production_BW`; retain separate source table/type. |
| `Stock_Movements` | `stock_position_id`, `date`, `time`, `raw_material_id`, `raw_material_name`, `weight_kg`. Use only active/non-soft-deleted rows. |
| `Stock_Levels` | `raw_material_id`, `raw_material_name`, `current_level_kg`, `min_level_kg`, `max_level_kg`, `status` (`ok`/`low`/`over`), computed refresh timestamp. |
| `Maintenance` | `maintenance_id`, `maintenance_date`, `machine_id`, `machine`, `machine_type`, `maintenance_type`, `description`, `downtime_minutes`, `cost`, `performed_by`. |
| `Reference_Data` | IDs and names for products, operators, machines, statuses, shifts, raw materials; supports validation and readable pivots. Avoid exporting personal identity data. |
| `Refresh_Log` | `run_started_at`, `run_finished_at`, `source`, `status`, `rows_loaded`, `error_summary`, `last_successful_refresh`. |

Dashboard metric definitions:

- `Total Production kg` = sum BW `weight_produced_kg` + sum HB `weight_produced_kg` for the selected date window. Keep the separate BW and HB cards too.
- `Good kg` = sum `good_weight_kg`, with null treated as produced weight only if matching the current backend OEE rule; label this convention.
- `Scrap kg` = sum `scrap_weight_kg`; null treated as zero.
- `Quality %` = `Good kg / Produced kg`; do not average individual record percentages.
- `Downtime minutes` = sum production `downtime_minutes`; maintenance downtime is a separate measure to avoid double counting.
- `OEE %` should match backend's machine-level definition and display null when required availability or quality inputs are absent. Aggregate component sums before computing ratios.
- `Stock kg` should come from `/stock-levels`; current implementation sums all non-soft-deleted `stock_position.weight` rows per raw material. Confirm operationally that each stock entry represents an additive quantity rather than a stocktake snapshot; if snapshots are entered, this implementation will overstate stock.
- Low-stock count = count of materials whose returned status is not `ok`; display `low` and `over` separately.

Suggested pivot/filter dimensions: date, production line (`BW`/`HB`), machine, operator, shift, product, status, raw material, maintenance type. Use stable ID columns as keys and display names as labels.

## 9. Python Refresh Script Guidance

No Python code is included in this explanation-only deliverable. Recommended separate scripts when implementation is authorized:

1. `refresh_excel_dashboard.py`: call authenticated API endpoints and write/replace named tables in an `.xlsx` file using `openpyxl` or `pandas` + `openpyxl`; refresh pivot tables/charts via Excel when needed.
2. `refresh_google_sheets_dashboard.py`: use Google Sheets API service-account OAuth and batch writes to the tabs above; keep credentials outside the workbook/repository.
3. Optional shared module `wbi_api_client.py`: token/session handling, pagination, retries, date filters, field normalization, and refresh logging. Prefer API reads to direct PostgreSQL access so role checks and backend calculations remain authoritative.

Recommended API extraction: `/dashboard` for manager aggregate values; `/dashboard/oee?days=...`, `/dashboard/trend?days=...`; paginated BW/HB routes for detail; `/stock-positions` and `/stock-levels`; `/machine-maintenance` for maintenance. Follow `totalPages` until all required rows are read. The current UI clients commonly default to page size 50; API services cap page size at 200.

Security and reliability requirements for those future scripts:

- Use a dedicated read-only account/role and least-privileged endpoints; do not hard-code JWTs, Google credentials, or database passwords.
- Store secrets in an OS credential store or environment/secret manager; keep `.env`, token caches, and service-account JSON out of version control.
- Never export `aadhaar_number`, Aadhaar image/file, personal address, emergency contacts, OTP hashes, passkey public credentials, or WebAuthn challenges into operational dashboards.
- Handle HTTP 401/403 distinctly; record refresh status and timestamps; avoid overwriting last-good workbook/sheet data if an API request fails partway through.
- Deduplicate on stable IDs; use ISO dates and numeric kg/min/currency types; preserve source-line values and distinguish blank/null from zero.
- Google Sheets API requires a configured Google Cloud project, enabled Sheets API, and explicit spreadsheet sharing with the service account. Excel refresh needs a local workbook path and a compatible Excel client for pivot refresh.

## 10. Source/Contract Notes to Resolve Before Analytics Rollout

1. **BW form/API contract differs from backend DTO.** The BW frontend service constructs a payload with `calendar_date`, lookup IDs (`operator_id`, `machine_id`, `shift_id`, `product_id`) and `status`; the NestJS BW controller/service expects `calendar_date`, `operator_name`, `machine_name`, `shift_name`, `product_name`, `status_name`. Reconcile this before relying on BW create/update integrations or deriving a shared import contract. HB frontend currently performs ID-to-name lookups and sends name-based payloads.
2. **BW/HB schemas are not symmetrical.** BW joins legacy singular `operator`, `machine`, `product`, `status`; HB joins `operators_list`, `machine_list`, `products_list` and stores status as text. Cross-line dashboard joins must branch by source, as `DashboardService` currently does.
3. **Stock material choices are hard-coded in the form.** `StockForm` currently offers `5.5 MM Rod`, `Powder`, `Carbide Die`; the database/API has `raw_material` and threshold management. A dashboard should obtain raw materials from persisted IDs/names, not assume that hard-coded list is exhaustive.
4. **GI/Legend records are mock-only.** The component calls `api.legend`, but those methods return seeded arrays and promises; no matching backend controller/entity exists. Treat this content as a prototype/reference guide only.
5. **TypeORM `synchronize: true`.** The backend currently requests automatic schema synchronization against PostgreSQL. Before production reporting or schema changes, confirm the deployed schema and migration policy; this document describes source entity declarations, not a live database introspection.
6. **Role gates and screen routes differ by feature.** Dashboard API is dev/manager-only; operator dashboard instead reads production-list APIs. Maintenance and audit are dev-only. Respect endpoint authorization even if a UI view or export link is visible.
7. **Contact inquiry documentation and implementation differ.** Controller comments describe the create route as public, but the actual `POST /contact-inquiries` has JWT and role guards. Use the decorator behavior as truth when integrating.
8. **Date/time calculations need a business timezone decision.** The backend contains an IST interceptor and database date dimensions; frontend dashboards also derive today's date from browser `toISOString()`. Agree an authoritative timezone before daily KPI reconciliation.
9. **Stock Dashboard's today's movement card is capped at eight records.** The screen requests the eight most recent stock rows and sums only those whose date is today. Treat this figure as a recent-row estimate, not a guaranteed daily total, until changed to a date-filtered aggregate.
10. **Stock validation differs at the UI/API boundary.** The UI schema requires weight greater than zero; the backend create service accepts zero. Validate imports against the stricter UI/business rule unless zero-weight records are intentionally supported.

## 11. Source Map

- Business overview and declared application stack: [README.md](README.md)
- Main app navigation, role gates, login/onboarding state: [App.tsx](reactjs-frontend-v1/src/app/App.tsx)
- Screen components: [Dashboard.tsx](reactjs-frontend-v1/src/app/components/Dashboard.tsx), [OperatorDashboard.tsx](reactjs-frontend-v1/src/app/components/OperatorDashboard.tsx), [StockPosition.tsx](reactjs-frontend-v1/src/app/components/stock_position/StockPosition.tsx), [ManufacturingBW.tsx](reactjs-frontend-v1/src/app/components/manufacturing_bw/ManufacturingBW.tsx), [ManufacturingHb.tsx](reactjs-frontend-v1/src/app/components/manufacturing_hb/ManufacturingHb.tsx)
- Forms and UI types: [ManufacturingForm.tsx](reactjs-frontend-v1/src/app/components/manufacturing_bw/ManufacturingForm.tsx), [ManufacturingHbForm.tsx](reactjs-frontend-v1/src/app/components/manufacturing_hb/ManufacturingHbForm.tsx), [StockForm.tsx](reactjs-frontend-v1/src/app/components/stock_position/StockForm.tsx), [types.ts](reactjs-frontend-v1/src/app/commons/types.ts)
- Admin/maintenance/audit/inquiries: [AdminSettings.tsx](reactjs-frontend-v1/src/app/components/admin_settings/AdminSettings.tsx), [AdminManagers.tsx](reactjs-frontend-v1/src/app/components/admin_settings/AdminManagers.tsx), [MachineMaintenance.tsx](reactjs-frontend-v1/src/app/components/maintenance/MachineMaintenance.tsx), [AuditLog.tsx](reactjs-frontend-v1/src/app/components/audit_log/AuditLog.tsx), [ContactInquiries.tsx](reactjs-frontend-v1/src/app/components/contact_inquiries/ContactInquiries.tsx)
- API route registration and auth: [app.module.ts](nestjs-backend/src/app.module.ts), [manufacturing-bw.controller.ts](nestjs-backend/src/modules/controllers/manufacturing-bw.controller.ts), [manufacturing-hb.controller.ts](nestjs-backend/src/modules/controllers/manufacturing-hb.controller.ts), [stock-position.controller.ts](nestjs-backend/src/modules/controllers/stock-position.controller.ts), [admin-settings.controller.ts](nestjs-backend/src/modules/controllers/admin-settings.controller.ts), [dashboard.controller.ts](nestjs-backend/src/modules/controllers/dashboard.controller.ts)
- Analytics rules: [dashboard.service.ts](nestjs-backend/src/modules/services/dashboard.service.ts)
- DB entity declarations: [entities/v1](nestjs-backend/src/modules/entities/v1)
- Frontend API implementations: [api.ts](reactjs-frontend-v1/src/app/services/api.ts), [manufacturing_bw_api.ts](reactjs-frontend-v1/src/app/services/manufacturing_bw_api.ts), [manufacturing_hb_api.ts](reactjs-frontend-v1/src/app/services/manufacturing_hb_api.ts), [admin-api.ts](reactjs-frontend-v1/src/app/services/admin-api.ts)