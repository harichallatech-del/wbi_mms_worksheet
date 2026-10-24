/** WBI MMS Apps Script module. Bound scripts share one global runtime. */
function renderStockDashboard_(s) {
  const levels=s.getRange('BC4:BI2003').getValues().filter(r=>r[0]!==''&&r[0]!==null).slice(0,25);
  const moves=s.getRange('BK4:BP2003').getValues().filter(r=>r[0]!==''&&r[0]!==null).slice(0,25);
  const lv=Array.from({length:25},(_,i)=>levels[i]?[levels[i][1],levels[i][2],levels[i][3],levels[i][4],levels[i][5],levels[i][6],'']:['','','','','','','']);
  const mv=Array.from({length:25},(_,i)=>moves[i]?[moves[i][0],moves[i][1],moves[i][2],moves[i][4],moves[i][5],'']:['','','','','','']);
  s.getRange('A13:G37').clearContent(); s.getRange('A13:G37').setValues(lv);
  s.getRange('I13:N37').clearContent(); s.getRange('I13:N37').setValues(mv);
}

function renderDashboard_(s) {
  const operators = s.getRange('CW4:DH2003').getValues().filter(r => r[0] !== '' && r[0] !== null).slice(0, 16);
  const ranked = Array.from({length:16}, (_, i) => operators[i] ? [operators[i][1],operators[i][2],operators[i][3],operators[i][4],operators[i][5],operators[i][9]] : ['','','','','','']);
  s.getRange('A20:F35').clearContent(); s.getRange('A20:F35').setValues(ranked);
  const events = s.getRange('DS4:DX2003').getValues().filter(r => r[0] !== '' && r[0] !== null).slice(0, 5);
  const activity = Array.from({length:5}, (_, i) => events[i] ? events[i].slice(0,6) : ['','','','','','']);
  s.getRange('A11:F15').clearContent(); s.getRange('A11:F15').setValues(activity);
  if (!events.length) s.getRange('A11').setValue('Recent activity appears when the WBI account can read audit logs.');
}

function renderAdminSettings_(s) {
  const refs = s.getRange('BC4:BJ2003').getValues().filter(r => r[0] !== '' && r[0] !== null);
  const list = (kind, column, count, width, project) => {
    const rows = refs.filter(r => String(r[0]).toLowerCase() === kind && String(r[5]).toLowerCase() !== 'false').map(project);
    if (!rows.length) return;
    const range = s.getRange(22, column, count, width); range.clearContent();
    const values = Array.from({length:count}, (_, i) => rows[i] || Array(width).fill(''));
    range.setValues(values);
  };
  list('product',1,79,3,r=>[r[2],'',String(r[5]).toLowerCase()==='false'?'No':'Yes']);
  list('operator',5,79,3,r=>[r[3],r[2],String(r[5]).toLowerCase()==='false'?'No':'Yes']);
  list('machine',9,79,3,r=>[r[3],r[2],r[7]]);
  list('status',13,79,2,r=>[r[2],String(r[5]).toLowerCase()==='false'?'No':'Yes']);
  const users = s.getRange('BL4:BO2003').getValues().filter(r => r[0] !== '' && r[0] !== null);
  if (users.length) {
    const values = Array.from({length:68}, (_, i) => users[i] ? [users[i][0],users[i][1],users[i][2],String(users[i][3]).toLowerCase()==='false'?'No':'Yes'] : ['','','','']);
    s.getRange('A33:D100').clearContent(); s.getRange('A33:D100').setValues(values);
  }
}
