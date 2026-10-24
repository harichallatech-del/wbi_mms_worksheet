import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'excel', 'workbooks');
const COLORS = {
  navy: '#18365B', blue: '#0B84F3', paleBlue: '#EAF4FF', paleGreen: '#EAF8F0',
  paleAmber: '#FFF4D6', paleRed: '#FDECEC', ink: '#1B2635', muted: '#64748B',
  line: '#D8E1EB', white: '#FFFFFF', gray: '#F4F6F8', green: '#11985A', amber: '#D78900',
};
const FONT = 'Arial';
const SEED = {
  rawMaterials: ['5.5 MM Rod', 'Powder', 'Carbide Die'],
  products: [
    ['10 G', '10 Gauge Wire'], ['12 G', '12 Gauge Wire'],
    ['16 G', '16 Gauge Wire'], ['20 G', '20 Gauge Wire'],
  ],
  statuses: ['Annealed', 'Non-Annealed', 'Normal'],
  bwOperators: ['BW-Nirmal', 'BW-Sahil', 'BW-Sandeep', 'BW-Shivam'],
  hbOperators: ['HB-Abhishek', 'HB-Nitesh', 'HB-Ravi'],
  bwMachines: [['BW 1', 'Floor B'], ['BW 2', 'Floor B']],
  hbMachines: [['HB 1', 'Floor A'], ['HB 2', 'Floor A']],
  shifts: ['Day', 'Night'],
  downtime: ['Breakdown', 'Setup / Changeover', 'Material Shortage', 'No Operator', 'Maintenance', 'Power Cut', 'Other'],
  rejection: ['Tensile Fail', 'Dimensional', 'Surface Defect', 'Coating Defect', 'Other'],
  maintenance: ['planned', 'unplanned'],
  roles: ['manager', 'stock-monitor', 'operator'],
};

const ROLE_SHEETS = {
  Manager: ['Dashboard', 'Stock Dashboard', 'Stock Position', 'Admin Settings', 'Audit Log', 'Inquiries'],
  'Stock Monitor': ['Stock Dashboard', 'Stock Positions'],
  Operators: ['Manufacturing BW', 'Manufacturing HB', 'Maintenance'],
};

function setValues(sheet, range, values) { sheet.getRange(range).values = values; }
function setFormulas(sheet, range, formulas) { sheet.getRange(range).formulas = formulas; }
function title(sheet, name, subtitle, width = 14) {
  sheet.showGridLines = false;
  sheet.getRange('A2').values = [[name]];
  sheet.getRange('A2').format = { font: { name: FONT, size: 16, bold: true, color: COLORS.navy } };
  sheet.getRange('A3').values = [[subtitle]];
  sheet.getRange('A3').format = { font: { name: FONT, size: 10, italic: true, color: COLORS.muted } };
  sheet.getRange(`A4:${col(width)}4`).format.borders = { bottom: { style: 'medium', color: COLORS.blue } };
  sheet.getRange(`A1:${col(width)}65`).format.font = { name: FONT, size: 10, color: COLORS.ink };
  sheet.getRange(`A1:${col(width)}65`).format.verticalAlignment = 'center';
  for (let i = 1; i <= width; i++) sheet.getRange(`${col(i)}1:${col(i)}65`).format.columnWidth = 17;
  sheet.getRange('A2').format.columnWidth = 25;
  sheet.getRange('A3').format.columnWidth = 26;
}
function col(n) {
  let s = '';
  while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function section(sheet, range, label) {
  sheet.getRange(range).format = { fill: COLORS.paleBlue, font: { name: FONT, size: 10, bold: true, color: COLORS.navy }, borders: { bottom: { style: 'thin', color: COLORS.line } } };
  sheet.getRange(range.split(':')[0]).values = [[label]];
}
function headers(sheet, row, labels, startCol = 1) {
  const range = `${col(startCol)}${row}:${col(startCol + labels.length - 1)}${row}`;
  sheet.getRange(range).values = [labels];
  sheet.getRange(range).format = { fill: COLORS.navy, font: { name: FONT, size: 10, bold: true, color: COLORS.white }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true };
  sheet.getRange(`${col(startCol)}${row}:${col(startCol + labels.length - 1)}${row + 26}`).format.borders = { insideHorizontal: { style: 'thin', color: COLORS.line }, bottom: { style: 'thin', color: COLORS.line } };
}
function input(sheet, row, label, defaultValue = null, options = {}) {
  sheet.getRange(`A${row}`).values = [[label]];
  sheet.getRange(`A${row}`).format.font = { name: FONT, size: 10, bold: true, color: COLORS.navy };
  const cell = sheet.getRange(`B${row}`);
  cell.values = [[defaultValue]];
  cell.format = { fill: COLORS.paleAmber, borders: { bottom: { style: 'thin', color: COLORS.line } }, verticalAlignment: 'center' };
  if (options.width) sheet.getRange('B1:B65').format.columnWidth = options.width;
  if (options.numberFormat) cell.format.numberFormat = options.numberFormat;
  if (options.list) cell.dataValidation = { rule: Array.isArray(options.list) ? { type: 'list', values: options.list } : { type: 'list', formula1: options.list } };
  if (options.required) sheet.getRange(`C${row}`).values = [['*']];
  if (options.note) { sheet.getRange(`D${row}`).values = [[options.note]]; sheet.getRange(`D${row}`).format.font = { name: FONT, size: 9, color: COLORS.muted }; }
  return `B${row}`;
}
function card(sheet, labelCell, valueCell, label, formulaOrValue, tint = COLORS.gray, numberFormat = '0') {
  sheet.getRange(labelCell).values = [[label]];
  sheet.getRange(labelCell).format = { fill: tint, font: { name: FONT, size: 9, color: COLORS.muted }, wrapText: true };
  if (typeof formulaOrValue === 'string' && formulaOrValue.startsWith('=')) sheet.getRange(valueCell).formulas = [[formulaOrValue]];
  else sheet.getRange(valueCell).values = [[formulaOrValue]];
  sheet.getRange(valueCell).format = { fill: tint, font: { name: FONT, size: 17, bold: true, color: COLORS.ink }, numberFormat };
}
function listValidation(sheet, address, colLetter, endRow = 55) {
  sheet.getRange(address).dataValidation = { rule: { type: 'list', formula1: `$${colLetter}$2:$${colLetter}$${endRow}` } };
}
function validations(sheet) {
  // One-screen reference columns support each workbook's dropdowns without adding extra tabs.
  const lists = [
    ['Raw material', SEED.rawMaterials], ['Product', SEED.products.map(x => x[0])], ['Status', SEED.statuses],
    ['BW operator', SEED.bwOperators], ['HB operator', SEED.hbOperators], ['BW machine', SEED.bwMachines.map(x => x[0])],
    ['HB machine', SEED.hbMachines.map(x => x[0])], ['Shift', SEED.shifts], ['Downtime reason', SEED.downtime],
    ['Rejection reason', SEED.rejection], ['Maintenance type', SEED.maintenance], ['Stock-monitor login', []],
    ['Operator login', []], ['Admin entity', ['status', 'product', 'operator', 'machine', 'login user']],
    ['Action', ['Create', 'Update', 'Delete']], ['Inquiry status', ['new', 'contacted', 'quoted', 'closed']],
    ['All machines', [...SEED.bwMachines.map(x => x[0]), ...SEED.hbMachines.map(x => x[0])]],
    ['Login role', SEED.roles],
  ];
  const startCol = 27; // AA
  const map = {};
  lists.forEach(([label, values], ix) => {
    const c = col(startCol + ix);
    sheet.getRange(`${c}1`).values = [[label]];
    sheet.getRange(`${c}1`).format = { fill: COLORS.gray, font: { name: FONT, size: 9, bold: true, color: COLORS.muted } };
    if (values.length) sheet.getRange(`${c}2:${c}${values.length + 1}`).values = values.map(v => [v]);
    map[label] = c;
  });
  const queueStart = 45; // AS
  const qh = ['Queue ID', 'Created at', 'Resource', 'Method', 'Path', 'Payload JSON', 'Status', 'Message', 'Updated at'];
  sheet.getRange('AS1:BA1').values = [qh];
  sheet.getRange('AS1:BA1').format = { fill: COLORS.gray, font: { name: FONT, size: 9, bold: true, color: COLORS.navy } };
  sheet.getRange('AS2:BA2001').format.font = { name: FONT, size: 9, color: COLORS.ink };
  return map;
}
function support(sheet, titleText, startColumn, labels, maxRows = 2000) {
  const endColumn = startColumn + labels.length - 1;
  sheet.getRange(`${col(startColumn)}1`).values = [[titleText]];
  sheet.getRange(`${col(startColumn)}1`).format = { fill: COLORS.gray, font: { name: FONT, size: 9, bold: true, color: COLORS.muted } };
  sheet.getRange(`${col(startColumn)}3:${col(endColumn)}3`).values = [labels];
  sheet.getRange(`${col(startColumn)}3:${col(endColumn)}3`).format = { fill: COLORS.paleBlue, font: { name: FONT, size: 9, bold: true, color: COLORS.navy }, wrapText: true };
  sheet.getRange(`${col(startColumn)}4:${col(endColumn)}${maxRows + 3}`).format.font = { name: FONT, size: 9, color: COLORS.muted };
}
function baseSheet(wb, name, subtitle, width = 14) {
  const sheet = wb.worksheets.getItem(name);
  title(sheet, name, subtitle, width);
  const refs = validations(sheet);
  return { sheet, refs };
}

function buildDashboard(wb) {
  const { sheet: s } = baseSheet(wb, 'Dashboard', 'Live management snapshot • values update after a successful WBI refresh', 14);
  card(s, 'A5', 'A6', 'Stock items', "=COUNTA('Stock Dashboard'!$BC$4:$BC$2003)", COLORS.paleBlue);
  card(s, 'D5', 'D6', 'BW production today (kg)', '=SUMIFS($BN$4:$BN$2003,$BD$4:$BD$2003,TODAY())', COLORS.paleGreen, '#,##0.00');
  card(s, 'G5', 'G6', 'HB production today (kg)', '=SUMIFS($CK$4:$CK$2003,$CA$4:$CA$2003,TODAY())', COLORS.paleAmber, '#,##0.00');
  card(s, 'J5', 'J6', 'Active operators', '=COUNTIF(\'Admin Settings\'!$G$22:$G$100,"Yes")', COLORS.paleBlue);
  s.getRange('A7').values = [['kg moved today']];
  s.getRange('A7').format = { font: { name: FONT, size: 9, color: COLORS.muted } };
  s.getRange('B7').formulas = [["=SUMIFS('Stock Dashboard'!$BP$4:$BP$2003,'Stock Dashboard'!$BL$4:$BL$2003,TODAY())"]];
  s.getRange('B7').format = { font: { name: FONT, size: 9, color: COLORS.muted }, numberFormat: '#,##0.00' };
  s.getRange('D7').formulas = [['=COUNTIF($BD$4:$BD$2003,TODAY())&" record(s) today"']];
  s.getRange('G7').formulas = [['=COUNTIF($CA$4:$CA$2003,TODAY())&" record(s) today"']];
  s.getRange('D7:G7').format = { font: { name: FONT, size: 9, color: COLORS.muted } };
  section(s, 'A9:F9', 'Live activity');
  headers(s, 10, ['Time', 'User', 'Action', 'Entity', 'Record ID', 'Details']);
  section(s, 'H9:K9', 'Production by shift');
  headers(s, 10, ['Shift', 'BW (kg)', 'HB (kg)', 'Total (kg)'], 8);
  setValues(s, 'H11:H12', [['Day'], ['Night']]);
  setFormulas(s, 'I11:K12', [
    ['=SUMIFS($BN$4:$BN$2003,$BJ$4:$BJ$2003,H11)', '=SUMIFS($CK$4:$CK$2003,$CG$4:$CG$2003,H11)', '=I11+J11'],
    ['=SUMIFS($BN$4:$BN$2003,$BJ$4:$BJ$2003,H12)', '=SUMIFS($CK$4:$CK$2003,$CG$4:$CG$2003,H12)', '=I12+J12'],
  ]);
  section(s, 'A18:F18', 'Top operators (all time)');
  headers(s, 19, ['Line', 'Shift', 'Operator', 'Records', 'Produced (kg)', 'Quality']);
  section(s, 'H16:K16', 'Reference data');
  setValues(s, 'H17:H21', [['Statuses'], ['Products'], ['Operators'], ['Machines'], ['Login users']]);
  setFormulas(s, 'I17:I21', [
    ["=COUNTA('Admin Settings'!$M$22:$M$100)"],
    ["=COUNTA('Admin Settings'!$A$22:$A$100)"],
    ["=COUNTA('Admin Settings'!$F$22:$F$100)"],
    ["=COUNTA('Admin Settings'!$J$22:$J$100)"],
    ["=COUNTA('Admin Settings'!$A$33:$A$100)"],
  ]);
  s.getRange('A11:F35').format.wrapText = true;
  s.getRange('A1:N35').format.verticalAlignment = 'center';
  s.getRange('A6:K6').format.numberFormat = '#,##0.00';
  support(s, 'WBI refresh source: Production_BW', 55, ['manufacturing_id','date','operator_id','operator','machine_id','machine','shift_id','shift','product_id','product','status','weight_produced_kg','start_time','end_time','downtime_minutes','downtime_reason','good_weight_kg','scrap_weight_kg','rejection_reason','rework_flag','quality_percent','created_at']);
  support(s, 'WBI refresh source: Production_HB', 78, ['manufacturing_id','date','operator_id','operator','machine_id','machine','shift_id','shift','product_id','product','status','weight_produced_kg','start_time','end_time','downtime_minutes','downtime_reason','good_weight_kg','scrap_weight_kg','rejection_reason','rework_flag','quality_percent','created_at']);
  support(s, 'WBI refresh source: Operator_Shift', 101, ['rank_by_produced_kg','line','shift','operator','records','produced_kg','good_kg','scrap_kg','downtime_minutes','quality_percent','period_start','period_end']);
  support(s, 'WBI refresh source: Machine_OEE', 114, ['machine_id','machine','records','downtime_minutes','availability_percent','quality_percent','performance_percent','oee_percent']);
  support(s, 'WBI refresh source: Audit_Log', 123, ['time','user','action','entity_type','record_id','details']);
  s.freezePanes.freezeRows(3);
  return s;
}

function buildStockDashboard(wb) {
  const { sheet: s, refs } = baseSheet(wb, 'Stock Dashboard', 'Inventory levels, reorder alerts, and recent stock movements', 14);
  input(s, 5, 'Stock-monitor account', null, { list: `$${refs['Stock-monitor login']}$2:$${refs['Stock-monitor login']}$55`, note: 'Workspace account selector only; not recorded on stock movements.' });
  card(s, 'A7', 'A8', 'Materials tracked', '=COUNTA($BC$4:$BC$2003)', COLORS.paleBlue);
  card(s, 'D7', 'D8', 'Current stock (kg)', '=SUM($BE$4:$BE$2003)', COLORS.paleGreen, '#,##0.00');
  card(s, 'G7', 'G8', 'Reorder alerts', '=COUNTIF($BH$4:$BH$2003,"low")+COUNTIF($BH$4:$BH$2003,"over")', COLORS.paleAmber);
  card(s, 'J7', 'J8', 'Today’s movements (kg)', '=SUMIFS($BP$4:$BP$2003,$BL$4:$BL$2003,TODAY())', COLORS.paleBlue, '#,##0.00');
  section(s, 'A11:G11', 'Stock levels and reorder thresholds');
  headers(s, 12, ['Material', 'Current (kg)', 'Min (kg)', 'Max (kg)', 'Status', 'Last updated', '']);
  section(s, 'I11:N11', 'Recent movements');
  headers(s, 12, ['Record ID', 'Date', 'Time', 'Raw material', 'Weight (kg)', 'Action'], 9);
  setValues(s, 'A13:G13', [['No stock levels loaded yet. Refresh from WBI-MMS to populate this view.', null, null, null, null, null, null]]);
  setValues(s, 'I13:N13', [['No stock movements loaded yet.', null, null, null, null, null]]);
  s.getRange('A13:G37').format.wrapText = true;
  support(s, 'WBI refresh source: Stock_Levels', 55, ['raw_material_id','raw_material_name','current_level_kg','min_level_kg','max_level_kg','status','computed_at']);
  support(s, 'WBI refresh source: Stock_Movements', 63, ['stock_position_id','date','time','raw_material_id','raw_material_name','weight_kg']);
  s.freezePanes.freezeRows(12);
  return s;
}

function buildStockPositions(wb, name, canWrite) {
  const { sheet: s, refs } = baseSheet(wb, name, canWrite ? 'Search, page, and record authorized stock movements' : 'Search and page through stock history • read only for this role', 14);
  if (name === 'Stock Positions') input(s, 5, 'Stock-monitor account', null, { list: `$${refs['Stock-monitor login']}$2:$${refs['Stock-monitor login']}$55`, note: 'Workspace account selector only; not recorded on stock movements.' });
  section(s, 'A7:F7', 'Search and filters');
  setValues(s, 'A8:N8', [['Search item/date', null, 'From', null, 'To', null, 'Page size', 25, 'Page action', 'Apply', 'Page', 1, 'Status', 'Apply filters']]);
  s.getRange('J8').dataValidation = { rule: { type: 'list', values: ['Apply', 'Previous', 'Next'] } };
  headers(s, 10, ['S.No', 'Date', 'Raw Material', 'Weight (kg)', 'Time', 'Actions']);
  setValues(s, 'A11:F11', [['No stock records loaded. Refresh or apply filters after loading data.', null, null, null, null, null]]);
  if (canWrite) {
    section(s, 'A38:D38', 'Add / update stock position');
    input(s, 39, 'Action', 'Create', { list: `$${refs.Action}$2:$${refs.Action}$4`, required: true });
    input(s, 40, 'Record ID', null, { note: 'Required for Update or Delete.' });
    input(s, 41, 'Date', null, { numberFormat: 'yyyy-mm-dd', required: true });
    input(s, 42, 'Time', null, { numberFormat: 'hh:mm', required: true });
    input(s, 43, 'Raw material', null, { list: `$${refs['Raw material']}$2:$${refs['Raw material']}$54`, required: true });
    input(s, 44, 'Weight (kg)', null, { numberFormat: '#,##0.00', required: true });
    input(s, 45, 'Delete confirmation', null, { note: 'Type DELETE only for an intentional deletion.' });
    setValues(s, 'A46:B46', [['Form status', 'Complete required fields']]);
    s.getRange('B39:B46').format = { fill: COLORS.paleAmber, borders: { bottom: { style: 'thin', color: COLORS.line } } };
    s.getRange('A47:D47').values = [['Run the WBI Operations queue action after checking required fields.', null, null, null]];
  } else {
    section(s, 'A38:D38', 'Read-only stock movement history');
    setValues(s, 'A39:D39', [['Stock Monitor access is read-only in the source WBI role matrix. Ask a Manager to record or edit stock.', null, null, null]]);
    s.getRange('A39:D39').format = { fill: COLORS.gray, font: { name: FONT, size: 10, color: COLORS.muted }, wrapText: true };
  }
  if (canWrite) {
    section(s, 'A49:D49', 'Update raw-material reorder thresholds');
    input(s, 50, 'Raw material', null, { list: `$${refs['Raw material']}$2:$${refs['Raw material']}$54`, required: true });
    input(s, 51, 'Minimum level (kg)', null, { numberFormat: '#,##0.00' });
    input(s, 52, 'Maximum level (kg)', null, { numberFormat: '#,##0.00' });
    setValues(s, 'A53:B53', [['Threshold status', 'Enter at least one threshold; minimum must not exceed maximum.']]);
  }
  support(s, 'WBI refresh source: Stock_Movements', 55, ['stock_position_id','date','time','raw_material_id','raw_material_name','weight_kg']);
  s.freezePanes.freezeRows(10);
  return s;
}

function buildAdmin(wb) {
  const { sheet: s, refs } = baseSheet(wb, 'Admin Settings', 'Manage reference lists and WBI login accounts • passkey secrets never appear in a workbook', 16);
  section(s, 'A5:D5', 'Add / update a reference entity or login user');
  input(s, 6, 'Entity', 'product', { list: `$${refs['Admin entity']}$2:$${refs['Admin entity']}$6`, required: true });
  input(s, 7, 'Action', 'Create', { list: `$${refs.Action}$2:$${refs.Action}$4`, required: true });
  input(s, 8, 'Record ID', null, { note: 'Required for Update or Delete.' });
  input(s, 9, 'Name', null, { required: true });
  input(s, 10, 'Type', 'BW', { list: ['BW', 'HB'], note: 'Required for Operator or Machine.' });
  input(s, 11, 'Description', null);
  input(s, 12, 'Location', null, { note: 'Optional for Machine.' });
  input(s, 13, 'Login role', 'operator', { list: `$${refs['Login role']}$2:$${refs['Login role']}$4` });
  input(s, 14, 'Mobile number', null, { note: 'Required for login account; handle as restricted data.' });
  input(s, 15, 'Active login', 'Yes', { list: ['Yes', 'No'] });
  input(s, 16, 'Delete confirmation', null, { note: 'Type DELETE only for an intentional deletion.' });
  setValues(s, 'A17:B17', [['Form status', 'Complete required fields']]);
  section(s, 'A20:C20', 'Products'); headers(s, 21, ['Product', 'Description', 'Active']);
  setValues(s, 'A22:B25', SEED.products); setValues(s, 'C22:C25', [['Yes'], ['Yes'], ['Yes'], ['Yes']]);
  section(s, 'E20:G20', 'Operators'); headers(s, 21, ['Type', 'Operator', 'Active'], 5);
  const ops = [...SEED.hbOperators.map(n => ['HB', n, 'Yes']), ...SEED.bwOperators.map(n => ['BW', n, 'Yes'])];
  setValues(s, 'E22:G28', ops);
  section(s, 'I20:K20', 'Machines'); headers(s, 21, ['Type', 'Machine', 'Location'], 9);
  setValues(s, 'I22:K25', [...SEED.bwMachines.map(m => ['BW', ...m]), ...SEED.hbMachines.map(m => ['HB', ...m])]);
  section(s, 'M20:N20', 'Statuses'); headers(s, 21, ['Status', 'Active'], 13);
  setValues(s, 'M22:N24', SEED.statuses.map(v => [v, 'Yes']));
  section(s, 'A31:D31', 'Login users'); headers(s, 32, ['Name', 'Mobile number', 'Role', 'Active']);
  setValues(s, 'A33:D34', [[null, null, null, null], [null, null, null, 'Sync active accounts from WBI-MMS to populate this list.']]);
  section(s, 'F31:J31', 'Passkeys (safe summary only)'); headers(s, 32, ['Account', 'Device name', 'Type', 'Last used', 'Created'], 6);
  setValues(s, 'F33:J33', [['No passkey summaries loaded.', null, null, null, null]]);
  s.getRange('A102:J102').values = [['Passkey device summaries omit credential IDs, public keys, and WebAuthn secrets. Manage or revoke credentials in WBI-MMS.', null, null, null, null, null, null, null, null, null]];
  s.getRange('A102:J102').format = { font: { name: FONT, size: 9, italic: true, color: COLORS.muted }, wrapText: true };
  s.getRange('A33:D100').format.wrapText = true;
  s.getRange('A6:B17').format.borders = { bottom: { style: 'thin', color: COLORS.line } };
  s.getRange('A6:B17').format.verticalAlignment = 'center';
  s.getRange('B10').dataValidation = { rule: { type: 'list', values: ['BW', 'HB'] } };
  support(s, 'WBI refresh source: Reference_Data', 55, ['entity_type','entity_id','name','type','code','is_active','ideal_rate_per_hour','location']);
  support(s, 'WBI refresh source: Login_Users', 64, ['name','phone','role','is_active']);
  support(s, 'WBI refresh source: Passkeys_Safe', 69, ['user_name','device_name','device_type','last_used_at','created_at']);
  s.freezePanes.freezeRows(21);
  return s;
}

function buildAudit(wb) {
  const { sheet: s } = baseSheet(wb, 'Audit Log', 'Read-only activity history • the source API currently restricts audit reads to Dev accounts', 12);
  setValues(s, 'A5:L5', [['Entity filter', 'All', 'Search', null, 'Page size', 25, 'Page action', 'Apply', 'Page', 1, 'Status', 'Ready']]);
  s.getRange('B5').dataValidation = { rule: { type: 'list', values: ['All', 'Stock Position', 'Manufacturing BW', 'Manufacturing HB', 'Maintenance', 'Admin'] } };
  s.getRange('H5').dataValidation = { rule: { type: 'list', values: ['Apply', 'Previous', 'Next'] } };
  section(s, 'A7:F7', 'Audit events');
  headers(s, 8, ['Time', 'User', 'Action', 'Entity', 'Record ID', 'Details']);
  setValues(s, 'A9:F9', [['No audit entries loaded. If WBI-MMS returns 403, the signed-in account lacks the current Dev-only audit permission.', null, null, null, null, null]]);
  s.getRange('A9:F34').format.wrapText = true;
  support(s, 'WBI refresh source: Audit_Log', 55, ['time','user','action','entity_type','record_id','details']);
  s.freezePanes.freezeRows(8);
  return s;
}

function buildInquiries(wb) {
  const { sheet: s, refs } = baseSheet(wb, 'Inquiries', 'Manager-only contact inquiries • keep this workbook in restricted storage', 14);
  card(s, 'A5', 'A6', 'Total', '=COUNTA($BC$4:$BC$2003)', COLORS.paleBlue);
  card(s, 'D5', 'D6', 'New', '=COUNTIF($BK$4:$BK$2003,"new")', COLORS.paleAmber);
  card(s, 'G5', 'G6', 'Contacted', '=COUNTIF($BK$4:$BK$2003,"contacted")', COLORS.paleBlue);
  card(s, 'J5', 'J6', 'Quoted / Closed', '=COUNTIF($BK$4:$BK$2003,"quoted")+COUNTIF($BK$4:$BK$2003,"closed")', COLORS.paleGreen);
  setValues(s, 'A8:L8', [['Search name, phone, product, or company', null, 'Status', 'All', 'Page size', 25, 'Page action', 'Apply', 'Page', 1, 'Status', 'Ready']]);
  s.getRange('D8').dataValidation = { rule: { type: 'list', values: ['All', 'new', 'contacted', 'quoted', 'closed'] } };
  s.getRange('H8').dataValidation = { rule: { type: 'list', values: ['Apply', 'Previous', 'Next'] } };
  section(s, 'A10:I10', 'Customer inquiries');
  headers(s, 11, ['#', 'Name / Phone', 'Product', 'Quantity', 'Source', 'Status', 'WhatsApp', 'Date', 'Actions']);
  setValues(s, 'A12:I12', [['No inquiries loaded. Refresh with a Manager account to retrieve contact records.', null, null, null, null, null, null, null, null]]);
  section(s, 'A40:D40', 'Update inquiry status');
  input(s, 41, 'Inquiry ID', null, { required: true });
  input(s, 42, 'New status', 'No change', { list: ['No change', 'new', 'contacted', 'quoted', 'closed'], required: true });
  input(s, 43, 'Mark WhatsApp sent', 'No', { list: ['Yes', 'No'] });
  setValues(s, 'A44:B44', [['Action status', 'Select a valid inquiry ID and action.']]);
  support(s, 'WBI refresh source: Inquiries', 55, ['inquiry_id','name','phone','email','company','product','quantity','source','status','whatsapp_sent','submitted_at','updated_at']);
  s.freezePanes.freezeRows(11);
  return s;
}

const PRODUCTION_HEADERS = ['manufacturing_id','date','operator_id','operator','machine_id','machine','shift_id','shift','product_id','product','status','weight_produced_kg','start_time','end_time','downtime_minutes','downtime_reason','good_weight_kg','scrap_weight_kg','rejection_reason','rework_flag','quality_percent','created_at'];
const VISIBLE_PRODUCTION = ['ID','Date','Operator','Machine','Shift','Product','Status','Produced (kg)','Downtime (min)','Good (kg)','Scrap (kg)','Quality'];
function buildProduction(wb, name, line) {
  const { sheet: s, refs } = baseSheet(wb, name, `Track ${line} production records with validated entry fields and searchable history`, 15);
  input(s, 5, 'Workspace account', null, { list: `$${refs['Operator login']}$2:$${refs['Operator login']}$55`, note: 'Account selector only; Operator below is the production roster value.' });
  card(s, 'A7', 'A8', 'Total production (kg)', '=SUM($BN$4:$BN$2003)', COLORS.paleBlue, '#,##0.00');
  card(s, 'D7', 'D8', 'Day shift (kg)', '=SUMIFS($BN$4:$BN$2003,$BJ$4:$BJ$2003,"Day")', COLORS.paleGreen, '#,##0.00');
  card(s, 'G7', 'G8', 'Night shift (kg)', '=SUMIFS($BN$4:$BN$2003,$BJ$4:$BJ$2003,"Night")', COLORS.paleAmber, '#,##0.00');
  setValues(s, 'A10:O10', [['Search operator/date', null, 'From', null, 'To', null, 'Shift', 'All', 'Page size', 25, 'Page action', 'Apply', 'Page', 1, 'Status']]);
  s.getRange('H10').dataValidation = { rule: { type: 'list', values: ['All', ...SEED.shifts] } };
  s.getRange('L10').dataValidation = { rule: { type: 'list', values: ['Apply', 'Previous', 'Next'] } };
  headers(s, 12, VISIBLE_PRODUCTION);
  setValues(s, 'A13:L13', [['No production records loaded.', null, null, null, null, null, null, null, null, null, null, null]]);
  section(s, 'A40:D40', 'Add / update production record');
  input(s, 41, 'Action', 'Create', { list: `$${refs.Action}$2:$${refs.Action}$4`, required: true });
  input(s, 42, 'Record ID', null, { note: 'Required for Update or Delete.' });
  input(s, 43, 'Date', null, { numberFormat: 'yyyy-mm-dd', required: true });
  input(s, 44, 'Operator', null, { list: `$${refs[line === 'BW' ? 'BW operator' : 'HB operator']}$2:$${refs[line === 'BW' ? 'BW operator' : 'HB operator']}$55`, required: true });
  input(s, 45, 'Machine', null, { list: `$${refs[line === 'BW' ? 'BW machine' : 'HB machine']}$2:$${refs[line === 'BW' ? 'BW machine' : 'HB machine']}$55`, required: true });
  input(s, 46, 'Shift', null, { list: `$${refs['Shift']}$2:$${refs['Shift']}$3`, required: true });
  input(s, 47, 'Product', null, { list: `$${refs.Product}$2:$${refs.Product}$55`, required: true });
  input(s, 48, 'Status', 'Normal', { list: `$${refs.Status}$2:$${refs.Status}$55`, required: true });
  input(s, 49, 'Weight produced (kg)', null, { numberFormat: '#,##0.00', required: true });
  input(s, 50, 'Start time', null, { numberFormat: 'hh:mm' });
  input(s, 51, 'End time', null, { numberFormat: 'hh:mm' });
  input(s, 52, 'Downtime (min)', null, { numberFormat: '#,##0.0' });
  input(s, 53, 'Downtime reason', null, { list: `$${refs['Downtime reason']}$2:$${refs['Downtime reason']}$8` });
  input(s, 54, 'Good weight (kg)', null, { numberFormat: '#,##0.00', note: 'Defaults to produced weight when omitted.' });
  input(s, 55, 'Scrap weight (kg)', null, { numberFormat: '#,##0.00' });
  input(s, 56, 'Rejection reason', null, { list: `$${refs['Rejection reason']}$2:$${refs['Rejection reason']}$6` });
  input(s, 57, 'Needs rework', 'No', { list: ['No', 'Yes'] });
  input(s, 58, 'Delete confirmation', null, { note: 'Type DELETE only for an intentional deletion.' });
  setValues(s, 'A59:B59', [['Form status', 'Complete all required fields']]);
  support(s, `WBI refresh source: Production_${line}`, 55, PRODUCTION_HEADERS);
  s.getRange('B49:B55').format.numberFormat = '#,##0.00';
  s.freezePanes.freezeRows(12);
  return s;
}

function buildMaintenance(wb) {
  const { sheet: s, refs } = baseSheet(wb, 'Maintenance', 'Record planned and unplanned maintenance • source API restricts writes to Dev accounts', 14);
  card(s, 'A5', 'A6', 'Total records', '=COUNTA($BC$4:$BC$2003)', COLORS.paleBlue);
  card(s, 'D5', 'D6', 'Downtime (min)', '=SUM($BJ$4:$BJ$2003)', COLORS.paleGreen, '#,##0.0');
  card(s, 'G5', 'G6', 'Unplanned breakdowns', '=COUNTIF($BH$4:$BH$2003,"unplanned")', COLORS.paleAmber);
  setValues(s, 'A8:O8', [['Search', null, 'From', null, 'To', null, 'Type', 'All', 'Page size', 25, 'Page action', 'Apply', 'Page', 1, 'Ready']]);
  s.getRange('H8').dataValidation = { rule: { type: 'list', values: ['All', ...SEED.maintenance] } };
  s.getRange('L8').dataValidation = { rule: { type: 'list', values: ['Apply', 'Previous', 'Next'] } };
  headers(s, 10, ['S.No','Date','Machine','Type','Description','Downtime (min)','Cost (₹)','Performed by','Actions']);
  setValues(s, 'A11:I11', [['No maintenance records loaded.', null, null, null, null, null, null, null, null]]);
  section(s, 'A39:D39', 'Add / update maintenance record');
  input(s, 40, 'Action', 'Create', { list: `$${refs.Action}$2:$${refs.Action}$4`, required: true });
  input(s, 41, 'Record ID', null, { note: 'Required for Update or Delete.' });
  input(s, 42, 'Machine', null, { list: `$${refs['All machines']}$2:$${refs['All machines']}$5` });
  input(s, 43, 'Date', null, { numberFormat: 'yyyy-mm-dd' });
  input(s, 44, 'Type', 'planned', { list: `$${refs['Maintenance type']}$2:$${refs['Maintenance type']}$3` });
  input(s, 45, 'Downtime (minutes)', 0, { numberFormat: '#,##0.0' });
  input(s, 46, 'Cost (₹)', 0, { numberFormat: '₹#,##0.00' });
  input(s, 47, 'Performed by', null);
  input(s, 48, 'Description', null);
  input(s, 49, 'Delete confirmation', null, { note: 'Type DELETE only for an intentional deletion.' });
  setValues(s, 'A50:B50', [['Form status', 'Optional fields may be left blank']]);
  support(s, 'WBI refresh source: Maintenance', 55, ['maintenance_id','maintenance_date','machine_id','machine','machine_type','maintenance_type','description','downtime_minutes','cost','performed_by']);
  s.freezePanes.freezeRows(10);
  return s;
}

async function build(role) {
  const wb = Workbook.create();
  // Create the full role sheet set before any cross-sheet formulas are written.
  ROLE_SHEETS[role].forEach(name => wb.worksheets.add(name));
  for (const sheet of ROLE_SHEETS[role]) {
    if (sheet === 'Dashboard') buildDashboard(wb);
    else if (sheet === 'Stock Dashboard') buildStockDashboard(wb);
    else if (sheet === 'Stock Position') buildStockPositions(wb, sheet, true);
    else if (sheet === 'Stock Positions') buildStockPositions(wb, sheet, false);
    else if (sheet === 'Admin Settings') buildAdmin(wb);
    else if (sheet === 'Audit Log') buildAudit(wb);
    else if (sheet === 'Inquiries') buildInquiries(wb);
    else if (sheet === 'Manufacturing BW') buildProduction(wb, sheet, 'BW');
    else if (sheet === 'Manufacturing HB') buildProduction(wb, sheet, 'HB');
    else if (sheet === 'Maintenance') buildMaintenance(wb);
  }
  wb.recalculate();
  await fs.mkdir(path.join(ROOT, 'build', 'previews'), { recursive: true });
  for (const name of ROLE_SHEETS[role]) {
    const range = name === 'Dashboard' ? 'A1:N35' : name === 'Admin Settings' ? 'A1:P35' : name === 'Inquiries' ? 'A1:N47' : name === 'Audit Log' ? 'A1:F34' : name.startsWith('Manufacturing') ? 'A1:L60' : name === 'Maintenance' ? 'A1:I55' : name.includes('Stock') ? 'A1:N47' : 'A1:N60';
    const preview = await wb.render({ sheetName: name, range, scale: 1, format: 'png' });
    await fs.writeFile(path.join(ROOT, 'build', 'previews', `${role.replaceAll(' ', '_')}_${name.replaceAll(' ', '_')}.png`), new Uint8Array(await preview.arrayBuffer()));
  }
  const inspect = await wb.inspect({ kind: 'sheet,table', maxChars: 2200, tableMaxRows: 7, tableMaxCols: 8 });
  await fs.mkdir(OUT, { recursive: true });
  const filename = role === 'Manager' ? 'WBI_Manager.xlsx' : role === 'Stock Monitor' ? 'WBI_Stock_Monitor.xlsx' : 'WBI_Operators.xlsx';
  const file = await SpreadsheetFile.exportXlsx(wb);
  await file.save(path.join(OUT, filename));
  console.log(`${filename}\n${inspect.ndjson}`);
}

await fs.mkdir(OUT, { recursive: true });
for (const role of Object.keys(ROLE_SHEETS)) await build(role);
