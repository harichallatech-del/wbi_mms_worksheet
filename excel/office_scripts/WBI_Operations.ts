type Cell = string | number | boolean;
type QueueItem = { resource: string; method: string; path: string; payload: Record<string, string | number | boolean | null>; statusCell: string };

const WBI = { raw: 'AA', product: 'AB', status: 'AC', bwOp: 'AD', hbOp: 'AE', bwMachine: 'AF', hbMachine: 'AG', shift: 'AH', down: 'AI', reject: 'AJ', maint: 'AK', stockUsers: 'AL', operatorUsers: 'AM', entity: 'AN', actions: 'AO', inquiry: 'AP', machines: 'AQ', roles: 'AR', queueCol: 45 };
const CAPACITY = 2000;

function main(workbook: ExcelScript.Workbook) {
  applyWbiValidations(workbook);
  initializeWbiFormDefaults(workbook);
  initializeWbiRoleScreens(workbook);
}

function initializeWbiFormDefaults(workbook: ExcelScript.Workbook) {
  const today = excelDate_(new Date());
  for (const sheet of workbook.getWorksheets()) {
    const n = sheet.getName();
    if (n === 'Stock Position' || n === 'Stock Positions') { blankSet_(sheet, 'B39', 'Create'); blankSet_(sheet, 'B41', today); blankSet_(sheet, 'B42', excelTime_(new Date())); }
    if (n === 'Manufacturing BW' || n === 'Manufacturing HB') { blankSet_(sheet, 'B41', 'Create'); blankSet_(sheet, 'B43', today); blankSet_(sheet, 'B48', 'Normal'); blankSet_(sheet, 'B57', 'No'); }
    if (n === 'Maintenance') { blankSet_(sheet, 'B40', 'Create'); blankSet_(sheet, 'B43', today); blankSet_(sheet, 'B44', 'planned'); blankSet_(sheet, 'B45', 0); blankSet_(sheet, 'B46', 0); }
    if (n === 'Admin Settings') { blankSet_(sheet, 'B6', 'product'); blankSet_(sheet, 'B7', 'Create'); blankSet_(sheet, 'B13', 'operator'); blankSet_(sheet, 'B15', 'Yes'); }
    if (n === 'Inquiries') { blankSet_(sheet, 'B42', 'No change'); blankSet_(sheet, 'B43', 'No'); }
  }
}

function fillSourceReferenceChoices(workbook: ExcelScript.Workbook) {
  const seeds: Cell[][] = [
    ['5.5 MM Rod','Powder','Carbide Die'], ['10 G','12 G','16 G','20 G'], ['Annealed','Non-Annealed','Normal'],
    ['BW-Nirmal','BW-Sahil','BW-Sandeep','BW-Shivam'], ['HB-Abhishek','HB-Nitesh','HB-Ravi'], ['BW 1','BW 2'], ['HB 1','HB 2'],
    ['Day','Night'], ['Breakdown','Setup / Changeover','Material Shortage','No Operator','Maintenance','Power Cut','Other'],
    ['Tensile Fail','Dimensional','Surface Defect','Coating Defect','Other'], ['planned','unplanned'], [], [],
    ['status','product','operator','machine','login user'], ['Create','Update','Delete'], ['new','contacted','quoted','closed'],
    ['BW 1','BW 2','HB 1','HB 2'], ['manager','stock-monitor','operator'],
  ];
  for (const sheet of workbook.getWorksheets()) {
    for (let i = 0; i < seeds.length; i++) {
      const values = seeds[i];
      if (!values.length) continue;
      const col = columnLetter_(27 + i), target = sheet.getRange(`${col}2:${col}55`);
      const existing = target.getTexts().some(row => row[0].trim() !== '');
      if (!existing) sheet.getRange(`${col}2:${col}${values.length + 1}`).setValues(values.map(v => [v]));
    }
  }
  console.log('Filled blank source-reference choices only; verify names against live WBI master data.');
}

function applyWbiValidations(workbook: ExcelScript.Workbook) {
  for (const sheet of workbook.getWorksheets()) {
    const n = sheet.getName();
    if (n === 'Stock Dashboard' || n === 'Stock Positions') listRule_(sheet, 'B5', WBI.stockUsers);
    if (n === 'Stock Position' || n === 'Stock Positions') {
      listRule_(sheet, 'B39', WBI.actions); listRule_(sheet, 'B43', WBI.raw); listValues_(sheet, 'J8', ['Apply','Previous','Next']);
      dateRule_(sheet, 'B41'); positiveRule_(sheet, 'B44');
      if (n === 'Stock Position') { listRule_(sheet, 'B50', WBI.raw); nonnegativeRule_(sheet, 'B51:B52'); }
    }
    if (n === 'Manufacturing BW' || n === 'Manufacturing HB') {
      listRule_(sheet, 'B5', WBI.operatorUsers); listRule_(sheet, 'B41', WBI.actions);
      listRule_(sheet, 'B44', n === 'Manufacturing BW' ? WBI.bwOp : WBI.hbOp);
      listRule_(sheet, 'B45', n === 'Manufacturing BW' ? WBI.bwMachine : WBI.hbMachine);
      listRule_(sheet, 'B46', WBI.shift); listRule_(sheet, 'B47', WBI.product); listRule_(sheet, 'B48', WBI.status);
      listRule_(sheet, 'B53', WBI.down); listRule_(sheet, 'B56', WBI.reject); listValues_(sheet, 'B57', ['No','Yes']);
      listValues_(sheet, 'H10', ['All','Day','Night']); listValues_(sheet, 'L10', ['Apply','Previous','Next']);
      dateRule_(sheet, 'B43'); positiveRule_(sheet, 'B49'); nonnegativeRule_(sheet, 'B52:B55');
    }
    if (n === 'Maintenance') {
      listRule_(sheet, 'B40', WBI.actions); listRule_(sheet, 'B42', WBI.machines); listRule_(sheet, 'B44', WBI.maint);
      listValues_(sheet, 'H8', ['All','planned','unplanned']); listValues_(sheet, 'L8', ['Apply','Previous','Next']);
      dateRule_(sheet, 'B43'); nonnegativeRule_(sheet, 'B45:B46');
    }
    if (n === 'Admin Settings') {
      listRule_(sheet, 'B6', WBI.entity); listRule_(sheet, 'B7', WBI.actions); listValues_(sheet, 'B10', ['BW','HB']);
      listRule_(sheet, 'B13', WBI.roles); listValues_(sheet, 'B15', ['Yes','No']);
    }
    if (n === 'Audit Log') { listValues_(sheet, 'B5', ['All','Stock Position','Manufacturing BW','Manufacturing HB','Maintenance','Admin']); listValues_(sheet, 'H5', ['Apply','Previous','Next']); }
    if (n === 'Inquiries') { listValues_(sheet, 'D8', ['All','new','contacted','quoted','closed']); listValues_(sheet, 'H8', ['Apply','Previous','Next']); listValues_(sheet, 'B42', ['No change','new','contacted','quoted','closed']); listValues_(sheet, 'B43', ['No','Yes']); }
  }
}

function queueCurrentForm(workbook: ExcelScript.Workbook) {
  const sheet = workbook.getActiveWorksheet();
  try {
    const item = buildQueueItem_(sheet);
    if (!item) throw new Error('This screen is read only. Open a supported entry form before queueing.');
    const queue = sheet.getRangeByIndexes(1, WBI.queueCol - 1, CAPACITY, 9), rows = queue.getValues();
    const free = rows.findIndex(row => text_(row[0]) === '' && text_(row[6]) === '');
    if (free < 0) throw new Error('This screen queue is full. Archive completed entries before adding more.');
    const id = 'WBI-' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + (free + 1);
    const record: Cell[] = [id, new Date().toISOString(), item.resource, item.method, item.path, JSON.stringify(item.payload), 'PENDING', '', ''];
    sheet.getRangeByIndexes(free + 1, WBI.queueCol - 1, 1, 9).setValues([record]);
    sheet.getRange(item.statusCell).setValue('Queued ' + id + ' • submit with the secured Python queue tool.');
    console.log('Queued ' + id + ' on ' + sheet.getName() + '; no API request was sent by the workbook.');
  } catch (err) { fail_(sheet, err); }
}

function buildQueueItem_(s: ExcelScript.Worksheet): QueueItem | null {
  const n = s.getName(), t = (a: string) => s.getRange(a).getText().trim(), v = (a: string) => s.getRange(a).getValue();
  const actionPath = (resource: string, action: string, id: string) => ({resource, method: action === 'Create' ? 'POST' : action === 'Update' ? 'PUT' : 'DELETE', path: '/' + resource + (action === 'Create' ? '' : '/' + encodeURIComponent(id))});
  const check = (action: string, id: string, confirmation: string, required: string[]) => {
    if (!['Create','Update','Delete'].includes(action)) throw new Error('Choose Create, Update, or Delete.');
    if (action !== 'Create' && !id) throw new Error('Enter a Record ID for Update or Delete.');
    if (action === 'Delete' && confirmation !== 'DELETE') throw new Error('Type DELETE in Delete confirmation before deleting.');
    const labels: Record<string,string> = n === 'Stock Position'
      ? {B41:'Date',B42:'Time',B43:'Raw material',B44:'Weight'}
      : {B43:'Date',B44:'Operator',B45:'Machine',B46:'Shift',B47:'Product',B48:'Status',B49:'Weight produced'};
    for (const cell of required) if (t(cell) === '') throw new Error((labels[cell] || cell) + ' is required.');
  };
  if (n === 'Stock Positions') return null;
  if (n === 'Stock Position') {
    const a=t('B39'), id=t('B40'); check(a,id,t('B45'),a==='Delete'?[]:['B41','B42','B43','B44']);
    if(a!=='Delete'&&!(Number(v('B44'))>0))throw new Error('Weight must be greater than zero.');
    const r=actionPath('stock-positions',a,id);
    return {...r,statusCell:'B46',payload:a==='Delete'?{}:{date:dateIso_(v('B41')),time:timeIso_(v('B42')),raw_material_name:t('B43'),weight:String(v('B44'))}};
  }
  if (n === 'Manufacturing BW' || n === 'Manufacturing HB') {
    const a=t('B41'),id=t('B42'); check(a,id,t('B58'),a==='Delete'?[]:['B43','B44','B45','B46','B47','B48','B49']);
    if(a!=='Delete'&&!(Number(v('B49'))>0))throw new Error('Weight produced must be greater than zero.');
    const r=actionPath(n==='Manufacturing BW'?'manufacturing-bw':'manufacturing-hb',a,id);
    return {...r,statusCell:'B59',payload:a==='Delete'?{}:{calendar_date:dateIso_(v('B43')),operator_name:t('B44'),machine_name:t('B45'),shift_name:t('B46'),product_name:t('B47'),status_name:t('B48'),weight_produced:Number(v('B49')),start_time:timeIso_(v('B50')),end_time:timeIso_(v('B51')),downtime_minutes:numberOrNull_(v('B52')),downtime_reason:t('B53')||null,good_weight:numberOrNull_(v('B54')),scrap_weight:numberOrNull_(v('B55')),rejection_reason:t('B56')||null,rework_flag:t('B57').toLowerCase()==='yes'}};
  }
  if (n === 'Maintenance') {
    const a=t('B40'),id=t('B41'); check(a,id,t('B49'),[]); const r=actionPath('machine-maintenance',a,id);
    return {...r,statusCell:'B50',payload:a==='Delete'?{}:{machine_name:t('B42')||null,maintenance_date:dateIso_(v('B43')),maintenance_type:t('B44')||'planned',downtime_minutes:numberOrNull_(v('B45'))??0,cost:numberOrNull_(v('B46'))??0,performed_by:t('B47')||null,description:t('B48')||null}};
  }
  if (n === 'Admin Settings') {
    const entity=t('B6').toLowerCase(),a=t('B7'),id=t('B8'); check(a,id,t('B16'),a==='Delete'?[]:entity==='login user'?['B9','B14','B13']:['B9']);
    const route=actionPath(entity==='login user'?'admin/auth-users':'admin/'+({status:'status',product:'products',operator:'operators',machine:'machines'} as Record<string,string>)[entity],a,id);
    const payload: Record<string,string|number|boolean|null> = a==='Delete'?{}:entity==='login user'?{name:t('B9'),phone:t('B14'),role:t('B13'),is_active:t('B15').toLowerCase()!=='no'}:{name:t('B9'),description:t('B11')||null};
    if(a!=='Delete'&&(entity==='operator'||entity==='machine'))payload.type=t('B10'); if(a!=='Delete'&&entity==='machine')payload.location=t('B12')||null;
    return {...route,statusCell:'B17',payload};
  }
  if (n === 'Inquiries') {
    const id=t('B41'), status=t('B42'), whatsapp=t('B43').toLowerCase()==='yes'; if(!id)throw new Error('Enter an Inquiry ID.');
    if((!status||status==='No change')&&!whatsapp)throw new Error('Choose a status or set Mark WhatsApp sent to Yes.');
    const updateStatus=!!status&&status!=='No change';
    return {resource:'contact-inquiries',method:'PUT',path:'/contact-inquiries/'+encodeURIComponent(id)+(updateStatus?'/status':'/whatsapp'),payload:updateStatus?{status}:{whatsapp_sent:true},statusCell:'B44'};
  }
  return null;
}

function queueThresholdUpdate(workbook: ExcelScript.Workbook) {
  const sheet = workbook.getActiveWorksheet();
  try {
    if (sheet.getName() !== 'Stock Position') throw new Error('Open the Manager Stock Position screen first.');
    const text = (a: string) => sheet.getRange(a).getText().trim();
    const raw = text('B50'), min = numberOrNull_(sheet.getRange('B51').getValue()), max = numberOrNull_(sheet.getRange('B52').getValue());
    if (!raw) throw new Error('Choose a raw material.');
    if (min === null && max === null) throw new Error('Enter a minimum or maximum threshold.');
    if (min !== null && (!Number.isFinite(min) || min < 0) || max !== null && (!Number.isFinite(max) || max < 0)) throw new Error('Thresholds must be non-negative numbers.');
    if (min !== null && max !== null && min > max) throw new Error('Minimum level cannot exceed maximum level.');
    const rows = sheet.getRangeByIndexes(1, WBI.queueCol - 1, CAPACITY, 9).getValues();
    const free = rows.findIndex(row => text_(row[0]) === '' && text_(row[6]) === '');
    if (free < 0) throw new Error('This screen queue is full. Archive completed entries before adding more.');
    const id = 'WBI-' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + (free + 1);
    const payload: Record<string,string|number|boolean|null> = {raw_material_name:raw};
    if (min !== null) payload.min_level = min;
    if (max !== null) payload.max_level = max;
    sheet.getRangeByIndexes(free + 1, WBI.queueCol - 1, 1, 9).setValues([[id,new Date().toISOString(),'raw-materials','PUT','/raw-materials/by-name',JSON.stringify(payload),'PENDING','','']]);
    sheet.getRange('B53').setValue('Queued ' + id + ' • submit with an authorized WBI account.');
    console.log('Queued threshold update ' + id + '; no API request was sent by the workbook.');
  } catch (err) { fail_(sheet, err); }
}

function clearCurrentForm(workbook: ExcelScript.Workbook) {
  const s=workbook.getActiveWorksheet(),n=s.getName();
  if (n === 'Stock Positions') throw new Error('This Stock Monitor screen is read only.');
  if(n==='Stock Position'||n==='Stock Positions'){s.getRange('B40').clear(ExcelScript.ClearApplyTo.contents);s.getRange('B43:B45').clear(ExcelScript.ClearApplyTo.contents);s.getRange('B39').setValue('Create');}
  else if(n==='Manufacturing BW'||n==='Manufacturing HB'){s.getRange('B42').clear(ExcelScript.ClearApplyTo.contents);s.getRange('B44:B47').clear(ExcelScript.ClearApplyTo.contents);s.getRange('B49:B56').clear(ExcelScript.ClearApplyTo.contents);s.getRange('B58').clear(ExcelScript.ClearApplyTo.contents);s.getRange('B41').setValue('Create');s.getRange('B48').setValue('Normal');s.getRange('B57').setValue('No');}
  else if(n==='Maintenance'){s.getRange('B41:B43').clear(ExcelScript.ClearApplyTo.contents);s.getRange('B47:B49').clear(ExcelScript.ClearApplyTo.contents);s.getRange('B40').setValue('Create');s.getRange('B44').setValue('planned');s.getRange('B45:B46').setValues([[0],[0]]);}
  else if(n==='Admin Settings'){s.getRange('B8:B12').clear(ExcelScript.ClearApplyTo.contents);s.getRange('B14').clear(ExcelScript.ClearApplyTo.contents);s.getRange('B16').clear(ExcelScript.ClearApplyTo.contents);s.getRange('B7').setValue('Create');s.getRange('B15').setValue('Yes');}
  else if(n==='Inquiries'){s.getRange('B41').clear(ExcelScript.ClearApplyTo.contents);s.getRange('B42').setValue('No change');s.getRange('B43').setValue('No');}
  else throw new Error('No entry form on this screen.');
}

function applyBrowseFilters(workbook: ExcelScript.Workbook) { renderPage(workbook, workbook.getActiveWorksheet(), 'Apply'); }
function previousBrowsePage(workbook: ExcelScript.Workbook) { renderPage(workbook, workbook.getActiveWorksheet(), 'Previous'); }
function nextBrowsePage(workbook: ExcelScript.Workbook) { renderPage(workbook, workbook.getActiveWorksheet(), 'Next'); }
function initializeWbiRoleScreens(workbook: ExcelScript.Workbook) {
  for(const s of workbook.getWorksheets()){
    if(['Stock Position','Stock Positions','Manufacturing BW','Manufacturing HB','Maintenance','Audit Log','Inquiries'].includes(s.getName()))renderPage(workbook,s,'Apply');
    if(s.getName()==='Stock Dashboard')renderStockDashboard(s);
    if(s.getName()==='Dashboard')renderDashboard(s);
    if(s.getName()==='Admin Settings')renderAdminSettings(s);
  }
}

function renderDashboard(sheet: ExcelScript.Worksheet) {
  const operators=(sheet.getRange('CW4:DH2003').getValues() as Cell[][]).filter(r=>r[0]!==''&&r[0]!==null).slice(0,18);
  const rows:Cell[][]=[];for(let i=0;i<16;i++){const r=operators[i];rows.push(r?[r[1],r[2],r[3],r[4],r[5],r[9]]:['','','','','','']);}
  sheet.getRange('A20:F35').clear(ExcelScript.ClearApplyTo.contents);sheet.getRange('A20:F35').setValues(rows);
  const events=(sheet.getRange('DS4:DX2003').getValues() as Cell[][]).filter(r=>r[0]!==''&&r[0]!==null).slice(0,25);
  const activity:Cell[][]=[];for(let i=0;i<25;i++){const r=events[i];activity.push(r?[r[0],r[1],r[2],r[3],r[4],r[5]]:['','','','','','']);}
  sheet.getRange('A11:F15').clear(ExcelScript.ClearApplyTo.contents);sheet.getRange('A11:F15').setValues(activity.slice(0,5));
  if(!events.length)sheet.getRange('A11').setValue('Recent activity is available only when the current WBI account can read audit logs.');
}

function renderAdminSettings(sheet: ExcelScript.Worksheet) {
  const refs=(sheet.getRange('BC4:BJ2003').getValues() as Cell[][]).filter(r=>r[0]!==''&&r[0]!==null);
  if(refs.length){
    const pick=(kind:string, column:number, count:number, columns:number, project:(r:Cell[])=>Cell[])=>{const all=refs.filter(r=>text_(r[0]).toLowerCase()===kind&&String(r[5]).toLowerCase()!=='false').map(project);if(!all.length)return;const target=sheet.getRangeByIndexes(21,column-1,count,columns);const rows:Cell[][]=[];for(let i=0;i<count;i++)rows.push(all[i]||Array(columns).fill(''));target.clear(ExcelScript.ClearApplyTo.contents);target.setValues(rows);};
    pick('product',1,79,3,r=>[r[2],'',String(r[5]).toLowerCase()==='false'?'No':'Yes']);
    pick('operator',5,79,3,r=>[r[3],r[2],String(r[5]).toLowerCase()==='false'?'No':'Yes']);
    pick('machine',9,79,3,r=>[r[3],r[2],r[7]]);
    pick('status',13,79,2,r=>[r[2],String(r[5]).toLowerCase()==='false'?'No':'Yes']);
  }
  const users=(sheet.getRange('BL4:BO2003').getValues() as Cell[][]).filter(r=>r[0]!==''&&r[0]!==null);
  if(users.length){const rows:Cell[][]=[];for(let i=0;i<68;i++){const r=users[i];rows.push(r?[r[0],r[1],r[2],String(r[3]).toLowerCase()==='false'?'No':'Yes']:['','','','']);}sheet.getRange('A33:D100').clear(ExcelScript.ClearApplyTo.contents);sheet.getRange('A33:D100').setValues(rows);}
}

function renderPage(workbook: ExcelScript.Workbook, sheet: ExcelScript.Worksheet, action: string) {
  const n=sheet.getName(),t=(a:string)=>sheet.getRange(a).getText().trim(),v=(a:string)=>sheet.getRange(a).getValue();
  let source='', output='', pageCell='', size=25, search='', from:Cell='', to:Cell='', matches:(r:Cell[])=>boolean=()=>true, project:(r:Cell[],i:number)=>Cell[]=r=>r;
  if(n==='Stock Position'||n==='Stock Positions'){source='BC4:BH2003';output='A11:F35';pageCell='L8';size=Number(v('H8'))||25;search=t('B8').toLowerCase();from=v('D8') as Cell;to=v('F8') as Cell;matches=r=>(!search||r.join(' ').toLowerCase().includes(search))&&dateBetween_(r[1],from,to);project=(r,i)=>[i+1,r[1],r[4],r[5],r[2],''];}
  else if(n==='Manufacturing BW'||n==='Manufacturing HB'){source='BC4:BX2003';output='A13:L37';pageCell='N10';size=Number(v('J10'))||25;search=t('B10').toLowerCase();from=v('D10') as Cell;to=v('F10') as Cell;const shift=t('H10');matches=r=>(!search||r.join(' ').toLowerCase().includes(search))&&dateBetween_(r[1],from,to)&&(!shift||shift==='All'||text_(r[7]).toLowerCase()===shift.toLowerCase());project=r=>[r[0],r[1],r[3],r[5],r[7],r[9],r[10],r[11],r[14],r[16],r[17],r[20]];}
  else if(n==='Maintenance'){source='BC4:BL2003';output='A11:I35';pageCell='N8';size=Number(v('J8'))||25;search=t('B8').toLowerCase();from=v('D8') as Cell;to=v('F8') as Cell;const typ=t('H8');matches=r=>(!search||r.join(' ').toLowerCase().includes(search))&&dateBetween_(r[1],from,to)&&(!typ||typ==='All'||text_(r[5]).toLowerCase()===typ.toLowerCase());project=(r,i)=>[i+1,r[1],r[3],r[5],r[6],r[7],r[8],r[9],''];}
  else if(n==='Audit Log'){source='BC4:BH2003';output='A9:F33';pageCell='J5';size=Number(v('F5'))||25;search=t('D5').toLowerCase();const entity=t('B5');matches=r=>(!search||r.join(' ').toLowerCase().includes(search))&&(entity==='All'||!entity||text_(r[3]).toLowerCase()===entity.toLowerCase());}
  else if(n==='Inquiries'){source='BC4:BN2003';output='A12:I36';pageCell='J8';size=Number(v('F8'))||25;search=t('B8').toLowerCase();const status=t('D8');matches=r=>(!search||r.join(' ').toLowerCase().includes(search))&&(status==='All'||!status||text_(r[8]).toLowerCase()===status.toLowerCase());project=(r,i)=>[i+1,[text_(r[1]),text_(r[2])].filter(Boolean).join(' / '),r[5],r[6],r[7],r[8],r[9]?'Sent':'Not sent',r[10],''];}
  else throw new Error('Open a supported Browse screen first.');
  const all=sheet.getRange(source).getValues() as Cell[][]; const filtered=all.filter(r=>r[0]!==''&&matches(r));
  const pageSize=Math.max(1,Math.min(100,size)),pages=Math.max(1,Math.ceil(filtered.length/pageSize)); let page=Math.max(1,Number(v(pageCell))||1);
  if(action==='Apply')page=1;else if(action==='Previous')page=Math.max(1,page-1);else if(action==='Next')page=Math.min(pages,page+1);page=Math.min(page,pages);sheet.getRange(pageCell).setValue(page);
  const target=sheet.getRange(output),numRows=target.getRowCount(),numCols=target.getColumnCount(); const visible:Cell[][]=[];
  for(let i=0;i<numRows;i++){const record=filtered[(page-1)*pageSize+i];visible.push(record?project(record,(page-1)*pageSize+i+1):Array(numCols).fill(''));}
  target.clear(ExcelScript.ClearApplyTo.contents);target.setValues(visible);
  const statusCell:Record<string,string>={'Stock Position':'N8','Stock Positions':'N8','Manufacturing BW':'O10','Manufacturing HB':'O10','Maintenance':'O8','Audit Log':'L5','Inquiries':'L8'};
  sheet.getRange(statusCell[n]).setValue('Page '+page+' of '+pages+' • '+filtered.length+' records • showing '+Math.min(pageSize,Math.max(0,filtered.length-(page-1)*pageSize)));
}

function renderStockDashboard(sheet: ExcelScript.Worksheet) {
  const levels=(sheet.getRange('BC4:BI2003').getValues() as Cell[][]).filter(r=>r[0]!==''), moves=(sheet.getRange('BK4:BP2003').getValues() as Cell[][]).filter(r=>r[0]!=='');
  const lv:Cell[][]=[],mv:Cell[][]=[];for(let i=0;i<25;i++){const a=levels[i],b=moves[i];lv.push(a?[a[1],a[2],a[3],a[4],a[5],a[6],'']:['','','','','','','']);mv.push(b?[b[0],b[1],b[2],b[4],b[5],'']:['','','','','','']);}
  sheet.getRange('A13:G37').clear(ExcelScript.ClearApplyTo.contents);sheet.getRange('A13:G37').setValues(lv);sheet.getRange('I13:N37').clear(ExcelScript.ClearApplyTo.contents);sheet.getRange('I13:N37').setValues(mv);
}

function listRule_(sheet: ExcelScript.Worksheet, cell: string, column: string) { sheet.getRange(cell).getDataValidation().setRule({list:{inCellDropDown:true,source:'='+column+'2:'+column+'55}});sheet.getRange(cell).getDataValidation().setErrorAlert({showAlert:true,style:ExcelScript.DataValidationAlertStyle.stop,title:'Choose a list value',message:'Select a current WBI reference value.'}); }
function listValues_(sheet: ExcelScript.Worksheet, cell: string, values: string[]) { sheet.getRange(cell).getDataValidation().setRule({list:{inCellDropDown:true,source:values.join(',')}}); }
function dateRule_(sheet: ExcelScript.Worksheet, cell: string) { sheet.getRange(cell).getDataValidation().setRule({date:{operator:ExcelScript.DataValidationOperator.greaterThan,formula1:0}}); }
function positiveRule_(sheet: ExcelScript.Worksheet, cell: string) { sheet.getRange(cell).getDataValidation().setRule({decimal:{operator:ExcelScript.DataValidationOperator.greaterThan,formula1:0}}); }
function nonnegativeRule_(sheet: ExcelScript.Worksheet, address: string) { sheet.getRange(address).getDataValidation().setRule({decimal:{operator:ExcelScript.DataValidationOperator.greaterThanOrEqualTo,formula1:0}}); }
function blankSet_(sheet:ExcelScript.Worksheet,address:string,value:Cell){if(sheet.getRange(address).getValue()==='')sheet.getRange(address).setValue(value);}
function text_(v:Cell):string{return v===null||v===undefined?'':String(v).trim();}
function dateIso_(value:Cell):string{if(typeof value==='number'){const d=new Date(Math.round((value-25569)*86400000));return d.toISOString().slice(0,10);}return String(value||'').slice(0,10);}
function timeIso_(value:Cell):string{if(typeof value==='number'){const mins=Math.round(value*1440),h=Math.floor(mins/60)%24,m=mins%60;return ('0'+h).slice(-2)+':'+('0'+m).slice(-2);}return String(value||'').slice(0,5);}
function numberOrNull_(v:Cell):number|null{return v===''||v===null?null:Number(v);}
function excelDate_(d:Date):number{return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000)+25569;}
function excelTime_(d:Date):number{return (d.getHours()*3600+d.getMinutes()*60+d.getSeconds())/86400;}
function dateSerial_(v:Cell):number{if(typeof v==='number')return Math.floor(v);const d=new Date(String(v));return isNaN(d.getTime())?0:Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000)+25569;}
function dateBetween_(v:Cell,from:Cell,to:Cell):boolean{const d=dateSerial_(v),f=from===''?0:dateSerial_(from),t=to===''?999999:dateSerial_(to);return (!f||d>=f)&&d<=t;}
function columnLetter_(n:number):string{let s='';while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;}
function fail_(sheet:ExcelScript.Worksheet,err:unknown){const message=err instanceof Error?err.message:String(err);const cells:Record<string,string>={'Stock Position':'B46','Stock Positions':'B46','Manufacturing BW':'B59','Manufacturing HB':'B59','Maintenance':'B50','Admin Settings':'B17','Inquiries':'B44'};const target=sheet.getName()==='Stock Position'&&sheet.getRange('B50').getText().trim()!==''?'B53':cells[sheet.getName()];if(target)sheet.getRange(target).setValue('ERROR: '+message);console.log('ERROR ['+sheet.getName()+']: '+message);}
