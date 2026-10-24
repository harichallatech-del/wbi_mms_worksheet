# WBI MMS Screen and Field Reference

## Purpose

Use this document as a handoff brief when prompting another developer or AI to
recreate, extend, or redesign the Wire Bind Industries Manufacturing Management
System (MMS). It describes the current React frontend, not a proposed redesign.
Field types and requirements below reflect the UI and validation where visible;
when a field's validation is not defined in the frontend, that is stated rather
than assumed.

## Screen count and counting rules

**21 unique primary screens** (**22 role-aware screen entries** if the Dev and
Manager versions of the shared management dashboard are counted separately).

- 3 public pages: home, product catalog, contact inquiry.
- 1 application sign-in screen.
- 16 authenticated app views: the top-level navigation screens, with the
  dashboard role variants and the six Admin Settings sections counted
  separately.
- The Admin Settings tab is counted as its six separately navigable sections,
  adding five views to the app-view count.
- 1 operator profile onboarding screen.

Counting: 3 public + 1 sign-in + 16 authenticated app views + 1 operator
onboarding = 21 unique screen layouts. Dev and Manager use the same management
dashboard component; counting those two role-specific accesses separately
produces 22 role-aware entries. Dialogs, responsive states, loading/error
states, tab controls inside a screen, and product detail sections are not
counted as primary screens. Unknown paths render the public home page rather
than creating another screen.

## App-wide behavior and design constraints

- **Product:** WBI manufacturing management for Binding Wire and related steel
  products. The authenticated app brand is “WBI – MMS”.
- **Frontend routes:** `/`, `/products`, `/contact`, and `/app/*`. Unknown paths
  fall back to `/`'s public home page.
- **Role model:** `dev`, `manager`, `operator`, `stock-monitor`.
- **Role access:**
  - Dev: every app tab.
  - Manager: dashboard, stock position, BW, HB, GI, Admin Settings, Inquiries.
  - Machine Operator: operator dashboard, BW, HB.
  - Stock Operator: stock dashboard, stock position.
- **Authentication:** sign-in uses passkeys (this device or QR/cross-device).
  Local development may have an opt-in dev-login bypass; do not carry that
  bypass into production.
- **Conventions:** dates use date controls; time uses time controls; production
  and stock weights are kilograms; monetary maintenance cost is rupees. Reference
  data choices (operators, machines, products, statuses) are loaded from the
  admin-managed data, not hard-coded into production forms.
- **Usability:** responsive layouts, visible labels, inline validation where
  present, loading/empty/error states, confirmation for destructive actions,
  accessible control names, and role-based navigation are part of the behavior.
- Do not invent requirements where the current UI does not define them. Confirm
  backend validation for field constraints not stated here.

## Primary screens (22)

### Public pages

#### 1. Public home — `/`

- **Purpose:** introduce Wire Bind Industries and direct visitors to products,
  contact/quote form, and the MMS.
- **Fields:** none.
- **Content/data attributes:** company branding, manufacturing capabilities,
  product highlights, feature/benefit cards, customer-facing calls to action,
  contact details, location, and footer navigation.
- **Actions:** navigate to product catalog and contact form; theme toggle;
  use prominent quote/contact actions.

#### 2. Product catalog — `/products`

- **Purpose:** public product-family overview and technical specification guide.
- **Fields:** none.
- **Each product family displays:** product name, tagline, description, image,
  key features, and specification rows.
- **Specification attributes:** gauge or nail size, diameter, length per 5 kg
  or approximate count (depending on family), and recommended use.
- **Actions:** jump to product sections, request a quote for a selected family
  (passes product in the contact URL), call to order, return home.
- Product-family names and exact specification values come from the catalog
  data in the frontend; preserve those data rather than inventing alternatives.

#### 3. Public contact / quote inquiry — `/contact`

| Field | Control / data type | Required | Attributes / choices |
|---|---|---:|---|
| Full Name | Text | Yes | Customer's name |
| Phone Number | Telephone | Yes | Contact number; example format includes `+91` |
| Email Address | Email | No | Reply address |
| Company / Organisation | Text | No | Company name |
| Product Interest | Select | Yes | Product options include Binding Wire gauges, Wire Nails sizes, Black Annealed Wire, Galvanised Binding Wire, and Custom / Other |
| Approximate Quantity | Select | No | 1–10, 10–50, 50–100, 100–500, 500+ coils, or custom quantity |
| Additional Details | Multiline text | No | Free-form requirements, gauge, delivery location, schedule, etc. |

- **Actions/states:** submit inquiry, submitting state, validation errors,
  duplicate-inquiry notice, submitted confirmation, send another inquiry,
  product catalog link.
- **Other page content:** direct phone/email/WhatsApp contact, visit address,
  quick links, public navigation, theme control.

### Authentication and role dashboards

#### 4. App sign-in — `/app/*` when unauthenticated

| Field | Control / data type | Required | Attributes / choices |
|---|---|---:|---|
| Mobile Number | Telephone | Needed for QR flow | 10-digit mobile identifier; placeholder asks for 10 digits |

- **Actions:** passkey sign-in on this device; QR-code cross-device sign-in;
  browser conditional passkey autofill. QR flow validates a 10-digit number.
- **No OTP field on this screen.** Keep the current passkey-first copy and
  security behavior unless explicitly changing scope.
- **Failure/unsupported state:** show passkey and QR errors or unsupported
  browser behavior; do not silently treat sign-in as successful.

#### 5. Management dashboard — `Dashboard` tab (`dev`, `manager`)

- **Fields:** none.
- **Summary attributes:** stock item count and today's stock weight; today's BW
  production weight/record count; today's HB production weight/record count;
  active operator count and login-user count.
- **Other read-only data:** live activity (category, actor/event, time), day and
  night shift output, top operators, admin reference-data counts (statuses,
  products, operators, machines, login users), machine OEE table.
- **OEE table attributes:** machine, record count, downtime minutes,
  availability %, quality %, optional performance %, OEE %.
- **Actions:** navigate using app tabs; no dashboard data-entry fields.

#### 6. Operator dashboard — `Dashboard` tab (`operator`)

- **Fields:** none.
- **Summary attributes:** signed-in operator's BW production today, HB
  production today, total production today, and record count today.
- **Other data:** operator's production history/summary as supplied by the
  dashboard data service.
- **Actions:** navigate to BW or HB production; no dashboard data-entry fields.

#### 7. Stock dashboard — `Stock Dashboard` tab (`dev`, `stock-monitor`)

- **Fields:** none.
- **Summary attributes:** materials tracked, current stock in kg, reorder
  alerts, today's stock movements in kg.
- **Per-material attributes:** raw material name, current quantity, unit,
  configured min/max threshold where available, status (OK / Low / Over).
- **Actions:** navigate to Stock Position; dev/manager-capable actions follow
  the role matrix (stock-monitor is read-only).

### Inventory and production

#### 8. Stock position — `Stock Position` tab (`dev`, `manager`, `stock-monitor`)

- **Search:** text search by item or date.
- **Record list attributes:** date, raw material/item, weight (kg), time,
  record actions. Management controls (add/edit/delete) are shown only to
  `dev` and `manager`.
- **Add/edit stock dialog:**

| Field | Control / data type | Required | Attributes / choices |
|---|---|---:|---|
| Date | Date | Yes | Stock movement date |
| Raw Material | Select | Yes | 5.5 MM Rod, Powder, Carbide Die |
| Weight (kg) | Decimal number | Yes | Step 0.01; must be positive |
| Time | Time | Yes | Movement time |

- **Stock-level configuration (where shown):** per-material Min level and Max
  level inputs, numeric; minimum must not exceed maximum when both are provided.
- **Actions:** add/edit/delete movement (management roles), search, configure
  stock thresholds. Preserve loading, empty, validation, and API error states.

#### 9. Manufacturing BW — `Manufacturing BW` tab

- **Search/filters:** search by operator or date; start date and end date.
- **Record attributes:** date, operator, machine, shift, product, status,
  produced weight (kg), start/end times, downtime minutes/reason, good/scrap
  weights, rejection reason, rework flag, quality % where present.
- **Add/edit production dialog:**

| Field | Control / data type | Required | Attributes / choices |
|---|---|---:|---|
| Date | Date | Yes | Required by schema |
| Operator | Select | Yes | Active/reference operators |
| Machine | Select | Yes | Reference machines |
| Shift | Select | Yes | Day or Night |
| Product | Select | Yes | Reference products |
| Status | Select | Defaults to Normal | Reference statuses |
| Weight Produced (kg) | Decimal number | Yes | Step 0.01; must be positive |
| Start Time | Time | No | OEE/downtime details |
| End Time | Time | No | OEE/downtime details |
| Downtime (min) | Non-negative number | No | OEE/downtime details |
| Downtime Reason | Select | No | Breakdown; Setup / Changeover; Material Shortage; No Operator; Maintenance; Power Cut; Other |
| Good Weight (kg) | Decimal number | No | Defaults to produced weight when omitted |
| Scrap Weight (kg) | Decimal number | No | Step 0.01; minimum 0 |
| Rejection Reason | Select | No | Tensile Fail; Dimensional; Surface Defect; Coating Defect; Other |
| Needs Rework | Boolean switch | No | Defaults false |

- **Actions:** add/edit/delete production records as permitted by the app,
  search and filter by date, review production summaries and records.
- The validation schema requires date, operator, machine, shift, product, and
  positive produced weight. Optional fields should remain optional.

#### 10. Manufacturing HB — `Manufacturing HB` tab

- **Search/filters:** search by operator; start date and end date.
- **Record attributes and production dialog fields:** same schema as BW:
  date, operator, machine, shift, product, status, produced kg, start/end time,
  downtime minutes/reason, good/scrap kg, rejection reason, needs-rework switch.
- **Choices and validation:** same choices and required fields as BW; this is a
  separate HB dataset and view, not a filter of BW.
- **Actions:** add/edit/delete HB production records as permitted; review
  operator performance, summary cards, and records.

#### 11. GI — `GI` tab (`dev`, `manager`)

- **Search:** product, operator, or machine.
- **List attributes:** product, type, status, HB operator, BW operator, GI
  operator, shift, machine, actions.
- **Add/edit reference entry:**

| Field | Control / data type | Required | Attributes / choices |
|---|---|---:|---|
| Product Name | Text | Yes | Example: `BW 1 12 G` |
| Product Type | Select | Yes | Current product-type values from reference data |
| Product Status | Select | Yes | Status reference data |
| Machine | Text | Yes | Machine name/identifier |
| HB Operator | Select | Yes | HB operators |
| BW Operator | Select | Yes | BW operators |
| GI Operator | Select | Yes | GI operators |
| Shift | Select | Yes | Day / Night |

- **Actions:** search, add/edit/delete a GI reference entry.

### Admin Settings

#### 12. Admin — Status

- **List attributes:** status name and edit/delete actions.
- **Add/edit fields:** Status Name (text; required by submit handler); Description
  (text; optional).
- **Actions:** add, edit, delete status. Confirm destructive actions.

#### 13. Admin — Products

- **List attributes:** product name, optional description, edit/delete actions.
- **Add/edit fields:** Product Name (text); Description (text, optional).
- **Actions:** add, edit, delete product. Production forms use this reference
  list.

#### 14. Admin — Operators

- **List attributes:** operator type badge (HB/BW), full name, edit/delete.
- **Add/edit fields:**
  - Type — select `HB (Hex Bolt)` or `BW (Binding Wire)`.
  - Operator Name — text; shown with its type prefix in the generated full name.
- **Actions:** add, edit, delete operator.

#### 15. Admin — Machines

- **List attributes:** type badge, machine name, optional location, edit/delete.
- **Add/edit fields:**
  - Type — select `HB (Hex Bolt)` or `BW (Binding Wire)`.
  - Machine Name — text.
  - Location — text, optional.
- **Actions:** add, edit, delete machine.

#### 16. Admin — Login Users

- **List attributes:** name, phone, role, Active/Disabled status, edit and
  deactivate actions.
- **Add/edit fields:**
  - Name — text.
  - Mobile Number — telephone; 10-digit number.
  - Role — select Dev User, Manager, Machine Operator, Stock Operator.
  - Active login — boolean toggle; disabling blocks login without deleting the
    user.
- **Actions:** add/edit login user; deactivate an active user. Roles govern
  app navigation and access.

#### 17. Admin — Passkeys

- **Purpose:** administrator overview of users' registered passkeys.
- **Fields:** none.
- **Read-only attributes:** user identity, registered passkey/device name,
  transport labels, registration/creation details as available.
- **Actions:** inspect passkey registrations; use the supported revoke/remove
  action if exposed by the current overview.

### Operations and administration

#### 18. Machine Maintenance — `Maintenance` tab (`dev`)

- **Record attributes:** date, machine, type, description, downtime minutes,
  cost (₹), performed by; add/edit/delete actions.
- **Add/edit fields:**

| Field | Control / data type | Required | Attributes / choices |
|---|---|---:|---|
| Machine | Select | Not enforced in visible UI | Reference machines |
| Date | Date | Not enforced in visible UI | Maintenance date |
| Type | Select | Default planned | Planned; Unplanned / Breakdown |
| Downtime (minutes) | Non-negative number | No | Default/placeholder 0 |
| Cost (₹) | Decimal number | No | Step 0.01; minimum 0 |
| Performed By | Text | No | Technician/person |
| Description | Text | No | Work done or breakdown reason |

- Preserve table/list states, retryable errors, and destructive-action
  confirmation.

#### 19. Audit Log — `Audit Log` tab (`dev`)

- **Fields:** none.
- **Filters:** entity-type chips, including All and entity types present in
  returned audit data.
- **Read-only columns:** time, user/performed-by, action, entity type, record
  ID, details (before/after values where available).
- **Actions:** refresh; filter by entity; dismiss visible error.

#### 20. Contact Inquiries — `Inquiries` tab (`dev`, `manager`)

- **Search:** name, phone, product, or company.
- **Status filter:** All, New, Contacted, Quoted, Closed.
- **Summary cards:** total, new, contacted, quoted, closed counts.
- **Table attributes:** row number, name/phone/company, product, quantity,
  source, status, WhatsApp state/action, date, actions.
- **Inquiry data attributes:** name, phone, email, company, product, quantity,
  message, source, status, submitted/updated date.
- **Actions:** refresh, update status, send/open a WhatsApp message, inspect
  inquiry actions. Status values are `new`, `contacted`, `quoted`, and `closed`.

#### 21. Operator profile onboarding — authenticated, first-time operator

| Field | Control / data type | Required | Attributes |
|---|---|---:|---|
| Full name | Text | Yes | Operator's profile name |
| Aadhaar number | Text | Yes | UI placeholder says 12 digits |
| Address | Multiline text | Yes | Postal/residential address |
| Father / guardian name | Text | No | — |
| Date of birth | Date | No | — |
| Alternate phone | Text | No | Alternate contact |
| Emergency contact name | Text | No | — |
| Emergency contact phone | Text | No | — |
| Notes / onboarding remarks | Multiline text | No | — |
| Aadhaar upload | Image file | Not marked required in UI | Accept image files; preview selected image |

- **Actions:** save profile, show submitting and explicit error states; after
  successful save continue to operator dashboard. The profile is required only
  for machine-operator role when the backend reports no profile.

## Shared dialogs and non-primary screens

These are important handoff scope but excluded from the primary-screen count:

- **Production add/edit dialogs:** BW and HB each have one dialog; field sets
  are detailed in screens 9 and 10.
- **Stock add/edit dialog:** detailed in screen 8.
- **GI add/edit dialog:** detailed in screen 11.
- **Maintenance add/edit dialog:** detailed in screen 18.
- **Passkey management dialog:** list registered passkeys and provide device
  name input (text, optional; label “Name this device”), register/remove
  passkeys, and show browser/device/error states.
- **Passkey onboarding dialog:** explains passkey setup and offers to create a
  passkey, manage passkeys, or dismiss. No profile data fields.
- **Install prompt:** install/PWA affordance where browser/platform supports it;
  no business fields.
- **Product detail sections:** inline catalog sections, not a separate route or
  modal; fields/attributes are defined in screen 2.
- **Shared UI states:** loading, empty data, API error/retry, save pending,
  validation feedback, success toast, delete confirmation, mobile responsive
  layout, and light/dark theme.

## Reusable prompt for another builder

> Build the WBI Manufacturing Management System described in
> `MMS_SCREEN_AND_FIELD_REFERENCE.md`. Implement all **21 unique primary
> screens** (22 role-aware entries if Dev and Manager dashboard access are
> counted separately), routes, data fields, types, choices, and actions in the
> reference.
> Treat the document as a source-of-truth inventory, preserve the WBI
> manufacturing domain and role-based access, and make each form accessible,
> responsive, validated, and explicit about loading, empty, success, and error
> states. Use the listed reference data for production/admin selects and keep
> production and stock quantities in kg. Do not invent extra fields or
> production requirements. Keep local-only authentication shortcuts out of
> production. Include the shared dialogs and responsive/theme behavior noted
> in the handoff. If backend contracts differ from the listed visible UI, call
> out the discrepancy rather than silently changing the field semantics.

## Source map

This inventory was checked against the React frontend:

- Route wiring: `reactjs-frontend-v1/src/main.tsx`
- App navigation, role access, dashboard selection, and app shell:
  `reactjs-frontend-v1/src/app/App.tsx`
- Screen components: `reactjs-frontend-v1/src/app/components/`
- Shared form/view data types:
  `reactjs-frontend-v1/src/app/commons/types.ts`
- Production and stock validation:
  `reactjs-frontend-v1/src/app/validations/manufacturing.schema.ts` and
  `reactjs-frontend-v1/src/app/validations/stock.schema.ts`
