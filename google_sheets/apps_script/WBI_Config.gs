/**
 * WBI MMS role workbook controls for Google Sheets.
 * This bound script validates forms, fills safe defaults, queues actions in the
 * active screen's AS:BA block, and renders filtered pages. It never stores API
 * credentials or sends writes directly; wbi_submit_queue.py is the write gate.
 */
const WBI_COL = { raw: 27, product: 28, status: 29, bwOp: 30, hbOp: 31, bwMachine: 32, hbMachine: 33, shift: 34, down: 35, reject: 36, maint: 37, stockUsers: 38, operatorUsers: 39, entity: 40, action: 41, inquiry: 42, machines: 43, roles: 44, queue: 45 };
const WBI_CAPACITY = 2000;
const WBI_PAGE_SIZE = 25;
const WBI_SEEDS = {
  raw: ['5.5 MM Rod', 'Powder', 'Carbide Die'], product: ['10 G', '12 G', '16 G', '20 G'],
  status: ['Annealed', 'Non-Annealed', 'Normal'], bwOp: ['BW-Nirmal', 'BW-Sahil', 'BW-Sandeep', 'BW-Shivam'],
  hbOp: ['HB-Abhishek', 'HB-Nitesh', 'HB-Ravi'], bwMachine: ['BW 1', 'BW 2'], hbMachine: ['HB 1', 'HB 2'],
  shift: ['Day', 'Night'], down: ['Breakdown', 'Setup / Changeover', 'Material Shortage', 'No Operator', 'Maintenance', 'Power Cut', 'Other'],
  reject: ['Tensile Fail', 'Dimensional', 'Surface Defect', 'Coating Defect', 'Other'], maint: ['planned', 'unplanned'],
  entity: ['status', 'product', 'operator', 'machine', 'login user'], action: ['Create', 'Update', 'Delete'],
  inquiry: ['new', 'contacted', 'quoted', 'closed'], machines: ['BW 1', 'BW 2', 'HB 1', 'HB 2'], roles: ['manager', 'stock-monitor', 'operator'],
};
