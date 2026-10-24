-- User-requested reference defaults for a clean WBI MMS starter database.
-- These are starter lookups; the live WBI API master lists win after a refresh.
-- No login-user identities, phones, passwords, or passkey material are seeded.

UPDATE reference_form_choices
SET selectable = 1,
    notes = 'Starter reference value supplied by the user; confirm it against the live WBI master before committing.'
WHERE (choice_group = 'raw_material' AND choice_value IN ('5.5 MM Rod','Powder','Carbide Die'))
   OR (choice_group = 'product' AND choice_value IN ('10 G','12 G','16 G','20 G'))
   OR (choice_group = 'status' AND choice_value IN ('Annealed','Non-Annealed','Normal'))
   OR (choice_group = 'machine' AND choice_value IN ('BW 1','BW 2','HB 1','HB 2'))
   OR (choice_group IN ('shift','maintenance_type','downtime_reason','rejection_reason'));

UPDATE reference_form_choices SET notes = '10 Gauge Wire; supplied by the user as a starter product description.' WHERE choice_group='product' AND choice_value='10 G';
UPDATE reference_form_choices SET notes = '12 Gauge Wire; supplied by the user as a starter product description.' WHERE choice_group='product' AND choice_value='12 G';
UPDATE reference_form_choices SET notes = '16 Gauge Wire; supplied by the user as a starter product description.' WHERE choice_group='product' AND choice_value='16 G';
UPDATE reference_form_choices SET notes = '20 Gauge Wire; supplied by the user as a starter product description.' WHERE choice_group='product' AND choice_value='20 G';

UPDATE reference_form_choices SET notes = 'Starter machine on Floor B; verify current live WBI master data.' WHERE choice_group='machine' AND choice_value IN ('BW 1','BW 2');
UPDATE reference_form_choices SET notes = 'Starter machine on Floor A; verify current live WBI master data.' WHERE choice_group='machine' AND choice_value IN ('HB 1','HB 2');

INSERT OR IGNORE INTO reference_form_choices
  (choice_group,choice_value,line_scope,source_kind,source_location,selectable,notes)
VALUES
  ('operator','HB-Abhishek','HB','business_reference','User-provided WBI MMS starter reference',1,'Starter roster label supplied by the user; replace with active API master values after sync.'),
  ('operator','HB-Nitesh','HB','business_reference','User-provided WBI MMS starter reference',1,'Starter roster label supplied by the user; replace with active API master values after sync.'),
  ('operator','HB-Ravi','HB','business_reference','User-provided WBI MMS starter reference',1,'Starter roster label supplied by the user; replace with active API master values after sync.'),
  ('operator','BW-Nirmal','BW','business_reference','User-provided WBI MMS starter reference',1,'Starter roster label supplied by the user; replace with active API master values after sync.'),
  ('operator','BW-Sahil','BW','business_reference','User-provided WBI MMS starter reference',1,'Starter roster label supplied by the user; replace with active API master values after sync.'),
  ('operator','BW-Sandeep','BW','business_reference','User-provided WBI MMS starter reference',1,'Starter roster label supplied by the user; replace with active API master values after sync.'),
  ('operator','BW-Shivam','BW','business_reference','User-provided WBI MMS starter reference',1,'Starter roster label supplied by the user; replace with active API master values after sync.'),
  ('machine','BW 1','BW','business_reference','User-provided WBI MMS starter reference',1,'Starter machine on Floor B; confirm against live WBI master.'),
  ('machine','BW 2','BW','business_reference','User-provided WBI MMS starter reference',1,'Starter machine on Floor B; confirm against live WBI master.'),
  ('machine','HB 1','HB','business_reference','User-provided WBI MMS starter reference',1,'Starter machine on Floor A; confirm against live WBI master.'),
  ('machine','HB 2','HB','business_reference','User-provided WBI MMS starter reference',1,'Starter machine on Floor A; confirm against live WBI master.'),
  ('auth_role','dev','','business_reference','WBI_BUSINESS_AND_DATA_REFERENCE.md',0,'Role value only; no user account is created.'),
  ('auth_role','manager','','business_reference','WBI_BUSINESS_AND_DATA_REFERENCE.md',0,'Role value only; no user account is created.'),
  ('auth_role','operator','','business_reference','WBI_BUSINESS_AND_DATA_REFERENCE.md',0,'Role value only; no user account is created.'),
  ('auth_role','stock-monitor','','business_reference','WBI_BUSINESS_AND_DATA_REFERENCE.md',0,'Role value only; no user account is created.');
