/** WBI MMS Apps Script module. Bound scripts share one global runtime. */
function queueCurrentForm() {
  const ss = SpreadsheetApp.getActive(), s = ss.getActiveSheet(), n = s.getName();
  try {
    const item = buildQueueItem_(s);
    if (!item) throw new Error('This screen is read only. Open a supported entry form before queueing.');
    const queueRange = s.getRange(2, WBI_COL.queue, WBI_CAPACITY, 9), rows = queueRange.getValues();
    const free = rows.findIndex(row => !String(row[0] || '').trim() && !String(row[6] || '').trim());
    if (free < 0) throw new Error('This screen queue is full. Archive completed entries before adding more.');
    const id = 'WBI-' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyyMMddHHmmss') + '-' + (free + 1);
    const row = [id, new Date(), item.resource, item.method, item.path, JSON.stringify(item.payload), 'PENDING', '', ''];
    s.getRange(free + 2, WBI_COL.queue, 1, 9).setValues([row]);
    if (item.statusCell) s.getRange(item.statusCell).setValue('Queued ' + id + ' • submit with the secured Python queue tool.');
    ss.toast('Queued ' + id + '. The workbook does not send API writes directly.', 'WBI Operations', 6);
    console.log(JSON.stringify({stage: 'queue', screen: n, queueId: id, resource: item.resource, action: item.method}));
  } catch (err) { reportError_(s, err); }
}

function queueThresholdUpdate() {
  const ss = SpreadsheetApp.getActive(), s = ss.getActiveSheet();
  try {
    if (s.getName() !== 'Stock Position') throw new Error('Open the Manager Stock Position screen first.');
    const raw = String(s.getRange('B50').getDisplayValue() || '').trim();
    const minValue = s.getRange('B51').getValue(), maxValue = s.getRange('B52').getValue();
    const min = minValue === '' ? null : Number(minValue), max = maxValue === '' ? null : Number(maxValue);
    if (!raw) throw new Error('Choose a raw material.');
    if (min === null && max === null) throw new Error('Enter a minimum or maximum threshold.');
    if (min !== null && (!Number.isFinite(min) || min < 0) || max !== null && (!Number.isFinite(max) || max < 0)) throw new Error('Thresholds must be non-negative numbers.');
    if (min !== null && max !== null && min > max) throw new Error('Minimum level cannot exceed maximum level.');
    const rows = s.getRange(2, WBI_COL.queue, WBI_CAPACITY, 9).getValues();
    const free = rows.findIndex(row => !String(row[0] || '').trim() && !String(row[6] || '').trim());
    if (free < 0) throw new Error('This screen queue is full. Archive completed entries before adding more.');
    const id = 'WBI-' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyyMMddHHmmss') + '-' + (free + 1);
    const payload = {raw_material_name: raw}; if (min !== null) payload.min_level = min; if (max !== null) payload.max_level = max;
    s.getRange(free + 2, WBI_COL.queue, 1, 9).setValues([[id, new Date(), 'raw-materials', 'PUT', '/raw-materials/by-name', JSON.stringify(payload), 'PENDING', '', '']]);
    s.getRange('B53').setValue('Queued ' + id + ' • submit with an authorized WBI account.');
    console.log(JSON.stringify({stage:'threshold_queue',screen:s.getName(),queueId:id}));
  } catch (err) { reportError_(s, err); }
}

function buildQueueItem_(s) {
  const n = s.getName(), v = a => s.getRange(a).getValue(), t = a => String(s.getRange(a).getDisplayValue() || '').trim();
  const actionPath = (resource, action, id) => ({resource, method: action === 'Create' ? 'POST' : action === 'Update' ? 'PUT' : 'DELETE', path: '/' + resource + (action === 'Create' ? '' : '/' + encodeURIComponent(id))});
  const checkAction = (action, id, confirmation, required) => {
    if (!['Create', 'Update', 'Delete'].includes(action)) throw new Error('Choose Create, Update, or Delete.');
    if (action !== 'Create' && !id) throw new Error('Enter a Record ID for Update or Delete.');
    if (action === 'Delete' && confirmation !== 'DELETE') throw new Error('Type DELETE in Delete confirmation before deleting.');
    required.forEach(([cell, label]) => { if (t(cell) === '') throw new Error(label + ' is required.'); });
  };
  if (n === 'Stock Positions') return null;
  if (n === 'Stock Position') {
    const action = t('B39'), id = t('B40'); checkAction(action, id, t('B45'), action === 'Delete' ? [] : [['B41','Date'],['B42','Time'],['B43','Raw material'],['B44','Weight']]);
    if (action !== 'Delete' && !(Number(v('B44')) > 0)) throw new Error('Weight must be greater than zero.');
    const route = actionPath('stock-positions', action, id);
    return {...route, statusCell: 'B46', payload: action === 'Delete' ? {} : {date: dateIso_(v('B41')), time: timeIso_(v('B42')), raw_material_name: t('B43'), weight: String(v('B44'))}};
  }
  if (n === 'Manufacturing BW' || n === 'Manufacturing HB') {
    const action = t('B41'), id = t('B42'); checkAction(action, id, t('B58'), action === 'Delete' ? [] : [['B43','Date'],['B44','Operator'],['B45','Machine'],['B46','Shift'],['B47','Product'],['B48','Status'],['B49','Weight produced']]);
    if (action !== 'Delete' && !(Number(v('B49')) > 0)) throw new Error('Weight produced must be greater than zero.');
    const resource = n === 'Manufacturing BW' ? 'manufacturing-bw' : 'manufacturing-hb', route = actionPath(resource, action, id);
    return {...route, statusCell: 'B59', payload: action === 'Delete' ? {} : {
      calendar_date: dateIso_(v('B43')), operator_name: t('B44'), machine_name: t('B45'), shift_name: t('B46'), product_name: t('B47'),
      status_name: t('B48'), weight_produced: Number(v('B49')), start_time: timeIso_(v('B50')), end_time: timeIso_(v('B51')),
      downtime_minutes: numberOrNull_(v('B52')), downtime_reason: t('B53') || null, good_weight: numberOrNull_(v('B54')),
      scrap_weight: numberOrNull_(v('B55')), rejection_reason: t('B56') || null, rework_flag: t('B57').toLowerCase() === 'yes',
    }};
  }
  if (n === 'Maintenance') {
    const action = t('B40'), id = t('B41'); checkAction(action, id, t('B49'), action === 'Delete' ? [] : []);
    const route = actionPath('machine-maintenance', action, id);
    return {...route, statusCell: 'B50', payload: action === 'Delete' ? {} : {
      machine_name: t('B42') || null, maintenance_date: dateIso_(v('B43')), maintenance_type: t('B44') || 'planned',
      downtime_minutes: numberOrNull_(v('B45')) ?? 0, cost: numberOrNull_(v('B46')) ?? 0, performed_by: t('B47') || null, description: t('B48') || null,
    }};
  }
  if (n === 'Admin Settings') {
    const entity = t('B6').toLowerCase(), action = t('B7'), id = t('B8'); checkAction(action, id, t('B16'), action === 'Delete' ? [] : entity === 'login user' ? [['B9','Name'],['B14','Mobile number'],['B13','Login role']] : [['B9','Name']]);
    const route = actionPath(entity === 'login user' ? 'admin/auth-users' : 'admin/' + ({status:'status',product:'products',operator:'operators',machine:'machines'}[entity] || ''), action, id);
    const payload = action === 'Delete' ? {} : entity === 'login user' ? {name:t('B9'), phone:t('B14'), role:t('B13'), is_active:t('B15').toLowerCase() !== 'no'} : {name:t('B9'), description:t('B11') || null};
    if (action !== 'Delete' && (entity === 'operator' || entity === 'machine')) payload.type = t('B10');
    if (action !== 'Delete' && entity === 'machine') payload.location = t('B12') || null;
    return {...route, statusCell: 'B17', payload};
  }
  if (n === 'Inquiries') {
    const id = t('B41'); if (!id) throw new Error('Enter an Inquiry ID.');
    const status = t('B42'), whatsapp = t('B43').toLowerCase() === 'yes';
    const updateStatus = !!status && status !== 'No change';
    if (!updateStatus && !whatsapp) throw new Error('Choose a status or set Mark WhatsApp sent to Yes.');
    if (updateStatus) return {resource:'contact-inquiries', method:'PUT', path:'/contact-inquiries/' + encodeURIComponent(id) + '/status', payload:{status}, statusCell:'B44'};
    return {resource:'contact-inquiries', method:'PUT', path:'/contact-inquiries/' + encodeURIComponent(id) + '/whatsapp', payload:{whatsapp_sent:true}, statusCell:'B44'};
  }
  return null;
}

function clearCurrentForm() {
  const s = SpreadsheetApp.getActiveSheet(), n = s.getName();
  if (n === 'Stock Positions') throw new Error('This Stock Monitor screen is read only.');
  const clear = addresses => addresses.forEach(a => s.getRange(a).clearContent());
  if (n === 'Stock Position' || n === 'Stock Positions') { clear(['B40','B43:B45']); s.getRange('B39').setValue('Create'); }
  else if (n === 'Manufacturing BW' || n === 'Manufacturing HB') { clear(['B42','B44:B47','B49:B56','B58']); s.getRange('B41').setValue('Create'); s.getRange('B48').setValue('Normal'); s.getRange('B57').setValue('No'); }
  else if (n === 'Maintenance') { clear(['B41:B43','B47:B49']); s.getRange('B40').setValue('Create'); s.getRange('B44').setValue('planned'); s.getRange('B45:B46').setValues([[0],[0]]); }
  else if (n === 'Admin Settings') { clear(['B8:B12','B14','B16']); s.getRange('B7').setValue('Create'); s.getRange('B15').setValue('Yes'); }
  else if (n === 'Inquiries') { clear(['B41']); s.getRange('B42').setValue('No change'); s.getRange('B43').setValue('No'); }
  else throw new Error('No entry form on this screen.');
  s.getRange(n === 'Stock Position' || n === 'Stock Positions' ? 'B46' : n === 'Maintenance' ? 'B50' : n === 'Admin Settings' ? 'B17' : n === 'Inquiries' ? 'B44' : 'B59').setValue('Form cleared.');
}
