/** WBI MMS Apps Script module. Bound scripts share one global runtime. */
function dateBetween_(value, from, to) {
  const serial = x => x instanceof Date ? Math.floor(Date.UTC(x.getFullYear(),x.getMonth(),x.getDate()) / 86400000) + 25569 : Number(x || 0);
  const day = serial(value), start = from ? serial(from) : 0, end = to ? serial(to) : 999999;
  return (!start || day >= start) && day <= end;
}

function dateIso_(value) { if(value instanceof Date)return Utilities.formatDate(value,SpreadsheetApp.getActive().getSpreadsheetTimeZone(),'yyyy-MM-dd'); return String(value||'').slice(0,10); }

function timeIso_(value) { if(value instanceof Date)return Utilities.formatDate(value,SpreadsheetApp.getActive().getSpreadsheetTimeZone(),'HH:mm'); return String(value||'').slice(0,5); }

function numberOrNull_(value) { return value===''||value===null?null:Number(value); }

function reportError_(s, err) {
  const msg=String(err&&err.message?err.message:err); console.error(JSON.stringify({stage:'spreadsheet_action',screen:s?s.getName():'unknown',message:msg}));
  try { const cell=s.getName()==='Stock Position'&&String(s.getRange('B50').getDisplayValue()||'').trim()?'B53':{ 'Stock Position':'B46','Stock Positions':'B46','Manufacturing BW':'B59','Manufacturing HB':'B59','Maintenance':'B50','Admin Settings':'B17','Inquiries':'B44' }[s.getName()]; if(cell)s.getRange(cell).setValue('ERROR: '+msg); } catch (_) {}
  SpreadsheetApp.getActive().toast(msg,'WBI Operations error',8);
}
