/** WBI MMS Apps Script module. Bound scripts share one global runtime. */
function sheet_(name) { return SpreadsheetApp.getActive().getSheetByName(name); }

function rangeList_(sheet, col, end = 55) { return sheet.getRange(2, col, end - 1, 1); }

function validationFrom_(sheet, col) {
  return SpreadsheetApp.newDataValidation().requireValueInRange(rangeList_(sheet, col), true).setAllowInvalid(false).build();
}

function validationValues_(values) {
  return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
}

function applyWbiValidations() {
  const ss = SpreadsheetApp.getActive();
  ss.getSheets().forEach(s => {
    const n = s.getName();
    const lookup = col => validationFrom_(s, col);
    if (n === 'Stock Dashboard' || n === 'Stock Positions') s.getRange('B5').setDataValidation(lookup(WBI_COL.stockUsers));
    if (n === 'Stock Position' || n === 'Stock Positions') {
      s.getRange('B39').setDataValidation(lookup(WBI_COL.action));
      s.getRange('B43').setDataValidation(lookup(WBI_COL.raw));
      s.getRange('J8').setDataValidation(validationValues_(['Apply', 'Previous', 'Next']));
      if (n === 'Stock Position') {
        s.getRange('B50').setDataValidation(lookup(WBI_COL.raw));
        s.getRange('B51:B52').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build());
      }
    }
    if (n === 'Manufacturing BW' || n === 'Manufacturing HB') {
      s.getRange('B5').setDataValidation(lookup(WBI_COL.operatorUsers));
      s.getRange('B41').setDataValidation(lookup(WBI_COL.action));
      s.getRange('B44').setDataValidation(lookup(n === 'Manufacturing BW' ? WBI_COL.bwOp : WBI_COL.hbOp));
      s.getRange('B45').setDataValidation(lookup(n === 'Manufacturing BW' ? WBI_COL.bwMachine : WBI_COL.hbMachine));
      s.getRange('B46').setDataValidation(lookup(WBI_COL.shift));
      s.getRange('B47').setDataValidation(lookup(WBI_COL.product));
      s.getRange('B48').setDataValidation(lookup(WBI_COL.status));
      s.getRange('B53').setDataValidation(lookup(WBI_COL.down));
      s.getRange('B56').setDataValidation(lookup(WBI_COL.reject));
      s.getRange('B57').setDataValidation(validationValues_(['No', 'Yes']));
      s.getRange('H10').setDataValidation(validationValues_(['All', 'Day', 'Night']));
      s.getRange('L10').setDataValidation(validationValues_(['Apply', 'Previous', 'Next']));
      s.getRange('B43').setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build());
      s.getRange('B49').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberGreaterThan(0).setAllowInvalid(false).build());
      s.getRange('B52:B55').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build());
    }
    if (n === 'Maintenance') {
      s.getRange('B40').setDataValidation(lookup(WBI_COL.action));
      s.getRange('B42').setDataValidation(lookup(WBI_COL.machines));
      s.getRange('B44').setDataValidation(lookup(WBI_COL.maint));
      s.getRange('B45:B46').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build());
      s.getRange('H8').setDataValidation(validationValues_(['All', 'planned', 'unplanned']));
      s.getRange('L8').setDataValidation(validationValues_(['Apply', 'Previous', 'Next']));
    }
    if (n === 'Admin Settings') {
      s.getRange('B6').setDataValidation(lookup(WBI_COL.entity));
      s.getRange('B7').setDataValidation(lookup(WBI_COL.action));
      s.getRange('B10').setDataValidation(validationValues_(['BW', 'HB']));
      s.getRange('B13').setDataValidation(lookup(WBI_COL.roles));
      s.getRange('B15').setDataValidation(validationValues_(['Yes', 'No']));
    }
    if (n === 'Audit Log') {
      s.getRange('B5').setDataValidation(validationValues_(['All', 'Stock Position', 'Manufacturing BW', 'Manufacturing HB', 'Maintenance', 'Admin']));
      s.getRange('H5').setDataValidation(validationValues_(['Apply', 'Previous', 'Next']));
    }
    if (n === 'Inquiries') {
      s.getRange('D8').setDataValidation(validationValues_(['All', 'new', 'contacted', 'quoted', 'closed']));
      s.getRange('H8').setDataValidation(validationValues_(['Apply', 'Previous', 'Next']));
      s.getRange('B42').setDataValidation(validationValues_(['No change', 'new', 'contacted', 'quoted', 'closed']));
      s.getRange('B43').setDataValidation(validationValues_(['No', 'Yes']));
    }
  });
  SpreadsheetApp.getActive().toast('WBI dropdowns and field validation are ready.', 'WBI Operations', 4);
}

function fillSourceReferenceChoices() {
  const seedByCol = [WBI_SEEDS.raw, WBI_SEEDS.product, WBI_SEEDS.status, WBI_SEEDS.bwOp, WBI_SEEDS.hbOp,
    WBI_SEEDS.bwMachine, WBI_SEEDS.hbMachine, WBI_SEEDS.shift, WBI_SEEDS.down, WBI_SEEDS.reject,
    WBI_SEEDS.maint, [], [], WBI_SEEDS.entity, WBI_SEEDS.action, WBI_SEEDS.inquiry, WBI_SEEDS.machines, WBI_SEEDS.roles];
  const ss = SpreadsheetApp.getActive();
  ss.getSheets().forEach(s => seedByCol.forEach((values, i) => {
    if (!values.length) return;
    const col = WBI_COL.raw + i, target = rangeList_(s, col);
    const existing = target.getDisplayValues().some(row => String(row[0] || '').trim());
    if (!existing) s.getRange(2, col, values.length, 1).setValues(values.map(v => [v]));
  }));
  ss.toast('Filled blank reference lists only. Verify reference suggestions with WBI master data.', 'WBI Operations', 6);
}

function fillWbiFormDefaults() {
  const ss = SpreadsheetApp.getActive(), today = new Date();
  ss.getSheets().forEach(s => {
    const n = s.getName();
    const setBlank = (cell, value) => { const r = s.getRange(cell); if (r.isBlank()) r.setValue(value); };
    if (n === 'Stock Position' || n === 'Stock Positions') { setBlank('B39', 'Create'); setBlank('B41', today); setBlank('B42', today); }
    if (n === 'Manufacturing BW' || n === 'Manufacturing HB') { setBlank('B41', 'Create'); setBlank('B43', today); setBlank('B48', 'Normal'); setBlank('B57', 'No'); }
    if (n === 'Maintenance') { setBlank('B40', 'Create'); setBlank('B43', today); setBlank('B44', 'planned'); setBlank('B45', 0); setBlank('B46', 0); }
    if (n === 'Admin Settings') { setBlank('B6', 'product'); setBlank('B7', 'Create'); setBlank('B13', 'operator'); setBlank('B15', 'Yes'); }
    if (n === 'Inquiries') { setBlank('B42', 'No change'); setBlank('B43', 'No'); }
  });
  SpreadsheetApp.getActive().toast('Filled safe defaults in blank form cells only.', 'WBI Operations', 4);
}
