/** WBI MMS Apps Script module. Bound scripts share one global runtime. */
function applyBrowseFilters() { renderPage_(SpreadsheetApp.getActiveSheet(), 'Apply'); }

function previousBrowsePage() { renderPage_(SpreadsheetApp.getActiveSheet(), 'Previous'); }

function nextBrowsePage() { renderPage_(SpreadsheetApp.getActiveSheet(), 'Next'); }

function renderPage_(s, action) {
  if (!s) return;
  const n = s.getName(), t = a => String(s.getRange(a).getDisplayValue() || '').trim(), v = a => s.getRange(a).getValue();
  let dataRange, outputRange, pageCell, size, search = '', from = '', to = '', filter = () => true, project = x => x;
  if (n === 'Stock Position' || n === 'Stock Positions') {
    dataRange='BC4:BH2003'; outputRange='A11:F35'; pageCell='L8'; size=Number(v('H8'))||25; search=t('B8').toLowerCase(); from=v('D8'); to=v('F8');
    filter=r=>(!search||r.join(' ').toLowerCase().includes(search))&&dateBetween_(r[1],from,to);
    project=(r,i)=>[i+1,r[1],r[4],r[5],r[2],''];
  } else if (n === 'Manufacturing BW' || n === 'Manufacturing HB') {
    dataRange='BC4:BX2003'; outputRange='A13:L37'; pageCell='N10'; size=Number(v('J10'))||25; search=t('B10').toLowerCase(); from=v('D10'); to=v('F10'); const shift=t('H10');
    filter=r=>(!search||r.join(' ').toLowerCase().includes(search))&&dateBetween_(r[1],from,to)&&(!shift||shift==='All'||String(r[7]).toLowerCase()===shift.toLowerCase());
    project=(r)=>[r[0],r[1],r[3],r[5],r[7],r[9],r[10],r[11],r[14],r[16],r[17],r[20]];
  } else if (n === 'Maintenance') {
    dataRange='BC4:BL2003'; outputRange='A11:I35'; pageCell='N8'; size=Number(v('J8'))||25; search=t('B8').toLowerCase(); from=v('D8'); to=v('F8'); const typ=t('H8');
    filter=r=>(!search||r.join(' ').toLowerCase().includes(search))&&dateBetween_(r[1],from,to)&&(!typ||typ==='All'||String(r[5]).toLowerCase()===typ.toLowerCase());
    project=(r,i)=>[i+1,r[1],r[3],r[5],r[6],r[7],r[8],r[9],''];
  } else if (n === 'Audit Log') {
    dataRange='BC4:BH2003'; outputRange='A9:F33'; pageCell='J5'; size=Number(v('F5'))||25; search=t('D5').toLowerCase(); const entity=t('B5');
    filter=r=>(!search||r.join(' ').toLowerCase().includes(search))&&(entity==='All'||!entity||String(r[3]).toLowerCase()===entity.toLowerCase());
  } else if (n === 'Inquiries') {
    dataRange='BC4:BN2003'; outputRange='A12:I36'; pageCell='J8'; size=Number(v('F8'))||25; search=t('B8').toLowerCase(); const status=t('D8');
    filter=r=>(!search||r.join(' ').toLowerCase().includes(search))&&(status==='All'||!status||String(r[8]).toLowerCase()===status.toLowerCase());
    project=(r,i)=>[i+1,[r[1],r[2]].filter(Boolean).join(' / '),r[5],r[6],r[7],r[8],r[9]?'Sent':'Not sent',r[10],''];
  } else { throw new Error('Open a supported Browse screen first.'); }
  const all=s.getRange(dataRange).getValues().filter(r=>r[0]!==''&&r[0]!==null&&filter(r));
  const pageSize=Math.max(1,Math.min(100,size)), pages=Math.max(1,Math.ceil(all.length/pageSize));
  let page=Math.max(1,Number(v(pageCell))||1);
  if(action==='Apply')page=1; else if(action==='Previous')page=Math.max(1,page-1); else if(action==='Next')page=Math.min(pages,page+1);
  page=Math.min(page,pages); s.getRange(pageCell).setValue(page);
  const visible=all.slice((page-1)*pageSize,page*pageSize).map((r,i)=>project(r,(page-1)*pageSize+i+1));
  const cols=s.getRange(outputRange).getNumColumns(), rows=s.getRange(outputRange).getNumRows();
  while(visible.length<rows)visible.push(Array(cols).fill(''));
  s.getRange(outputRange).clearContent(); s.getRange(outputRange).setValues(visible.slice(0,rows));
  const msg='Page '+page+' of '+pages+' • '+all.length+' records • showing '+Math.min(pageSize,all.length-(page-1)*pageSize);
  const statusCell={ 'Stock Position':'N8','Stock Positions':'N8','Manufacturing BW':'O10','Manufacturing HB':'O10','Maintenance':'O8','Audit Log':'L5','Inquiries':'L8' }[n];
  s.getRange(statusCell).setValue(msg);
}
