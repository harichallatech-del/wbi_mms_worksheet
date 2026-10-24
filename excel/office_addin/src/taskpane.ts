import { RecordService } from './application/RecordService';
import { OfficeTableRepository } from './infrastructure/OfficeTableRepository';
import type { FieldDefinition, ScreenDefinition, WbiRecord } from './domain/records';

const screens: Readonly<Record<string, ScreenDefinition>> = {
  Maintenance: {
    worksheet: 'Maintenance', table: 'tblMaintenance', title: 'Machine Maintenance',
    fields: [
      { key: 'Date', label: 'Date', kind: 'date', required: true },
      { key: 'Machine', label: 'Machine', kind: 'select', options: ['BW 1', 'BW 2', 'HB 1', 'HB 2'], required: true },
      { key: 'Type', label: 'Type', kind: 'select', options: ['planned', 'unplanned'], required: true },
      { key: 'Downtime (min)', label: 'Downtime (minutes)', kind: 'number', min: 0 },
      { key: 'Cost', label: 'Cost (₹)', kind: 'number', min: 0 },
      { key: 'Performed By', label: 'Performed By', kind: 'text' },
      { key: 'Description', label: 'Description', kind: 'text' },
    ],
    columns: ['Date', 'Machine', 'Type', 'Description', 'Downtime (min)', 'Cost', 'Performed By'],
    queue: { resource: 'machine-maintenance', path: '/machine-maintenance', payload: (r) => ({
      machine_name: r.Machine, maintenance_date: r.Date, maintenance_type: r.Type,
      downtime_minutes: r['Downtime (min)'] ?? 0, cost: r.Cost ?? 0,
      performed_by: r['Performed By'], description: r.Description,
    }) },
  },
  'Stock Position': {
    worksheet: 'Stock Position', table: 'tblStockPositions', title: 'Stock Position',
    fields: [
      { key: 'Date', label: 'Date', kind: 'date', required: true },
      { key: 'Raw Material', label: 'Raw Material', kind: 'select', options: ['5.5 MM Rod', 'Powder', 'Carbide Die'], required: true },
      { key: 'Weight (kg)', label: 'Weight (kg)', kind: 'number', required: true, min: Number.MIN_VALUE },
      { key: 'Time', label: 'Time', kind: 'time' },
    ],
    columns: ['Date', 'Raw Material', 'Weight (kg)', 'Time'],
    queue: { resource: 'stock-positions', path: '/stock-positions', payload: (r) => ({
      date: r.Date, time: r.Time, raw_material_name: r['Raw Material'], weight: r['Weight (kg)'],
    }) },
  },
  'Manufacturing BW': {
    worksheet: 'Manufacturing BW', table: 'tblManufacturingBW', title: 'Manufacturing BW',
    fields: productionFields(['BW-Nirmal', 'BW-Sahil', 'BW-Sandeep', 'BW-Shivam'], ['BW 1', 'BW 2']),
    columns: ['Date', 'Operator', 'Machine', 'Shift', 'Product', 'Status', 'Weight Produced (kg)', 'Downtime (min)', 'Good Weight (kg)', 'Scrap Weight (kg)'],
    queue: { resource: 'manufacturing-bw', path: '/manufacturing-bw', payload: productionPayload },
  },
  'Manufacturing HB': {
    worksheet: 'Manufacturing HB', table: 'tblManufacturingHB', title: 'Manufacturing HB',
    fields: productionFields(['HB-Abhishek', 'HB-Nitesh', 'HB-Ravi'], ['HB 1', 'HB 2']),
    columns: ['Date', 'Operator', 'Machine', 'Shift', 'Product', 'Status', 'Weight Produced (kg)', 'Downtime (min)', 'Good Weight (kg)', 'Scrap Weight (kg)'],
    queue: { resource: 'manufacturing-hb', path: '/manufacturing-hb', payload: productionPayload },
  },
};

function productionFields(operators: readonly string[], machines: readonly string[]): readonly FieldDefinition[] {
  return [
    { key: 'Date', label: 'Date', kind: 'date', required: true },
    { key: 'Operator', label: 'Operator', kind: 'select', options: operators, required: true },
    { key: 'Machine', label: 'Machine', kind: 'select', options: machines, required: true },
    { key: 'Shift', label: 'Shift', kind: 'select', options: ['Day', 'Night'], required: true },
    { key: 'Product', label: 'Product', kind: 'select', options: ['10 G', '12 G', '16 G', '20 G'], required: true },
    { key: 'Status', label: 'Status', kind: 'select', options: ['Normal', 'Annealed', 'Non-Annealed'], required: true },
    { key: 'Weight Produced (kg)', label: 'Weight Produced (kg)', kind: 'number', required: true, min: Number.MIN_VALUE },
    { key: 'Start Time', label: 'Start Time', kind: 'time' },
    { key: 'End Time', label: 'End Time', kind: 'time' },
    { key: 'Downtime (min)', label: 'Downtime (min)', kind: 'number', min: 0 },
    { key: 'Downtime Reason', label: 'Downtime Reason', kind: 'text' },
    { key: 'Good Weight (kg)', label: 'Good Weight (kg)', kind: 'number', min: 0 },
    { key: 'Scrap Weight (kg)', label: 'Scrap Weight (kg)', kind: 'number', min: 0 },
    { key: 'Rejection Reason', label: 'Rejection Reason', kind: 'text' },
    { key: 'Rework', label: 'Rework', kind: 'select', options: ['No', 'Yes'] },
  ];
}

function productionPayload(r: WbiRecord): WbiRecord {
  return {
    calendar_date: r.Date, operator_name: r.Operator, machine_name: r.Machine,
    shift_name: r.Shift, product_name: r.Product, status_name: r.Status,
    weight_produced: r['Weight Produced (kg)'], start_time: r['Start Time'], end_time: r['End Time'],
    downtime_minutes: r['Downtime (min)'], downtime_reason: r['Downtime Reason'],
    good_weight: r['Good Weight (kg)'], scrap_weight: r['Scrap Weight (kg)'],
    rejection_reason: r['Rejection Reason'], rework_flag: String(r.Rework ?? 'No').toLowerCase() === 'yes',
  };
}

let definition: ScreenDefinition | undefined;
let service: RecordService<WbiRecord> | undefined;
let currentPage = 1;

Office.onReady(async () => {
  try {
    const worksheetName = await Excel.run(async (context) => {
      const worksheet = context.workbook.worksheets.getActiveWorksheet();
      worksheet.load('name');
      await context.sync();
      return worksheet.name;
    });
    definition = screens[worksheetName];
    byId('screen-name').textContent = worksheetName;
    if (!definition) {
      showNotice('Open Maintenance, Stock Position, Manufacturing BW, or Manufacturing HB to use this panel.');
      return;
    }
    service = new RecordService(new OfficeTableRepository<WbiRecord>(definition.worksheet, definition.table));
    renderForm(definition);
    bindEvents();
    await refresh();
  } catch (error) {
    showNotice(errorMessage(error), true);
  }
});

function renderForm(screen: ScreenDefinition): void {
  byId('form-title').textContent = `Add ${screen.title} record`;
  const form = byId('record-form') as HTMLFormElement;
  form.replaceChildren();
  for (const field of screen.fields) {
    const label = document.createElement('label');
    label.append(document.createTextNode(field.label + (field.required ? ' *' : '')));
    const input = field.kind === 'select' ? document.createElement('select') : document.createElement('input');
    input.name = field.key;
    input.required = Boolean(field.required);
    if (input instanceof HTMLInputElement) {
      input.type = field.kind === 'select' ? 'text' : field.kind;
      if (field.kind === 'number' && field.min !== undefined) input.min = String(field.min);
    }
    if (input instanceof HTMLSelectElement) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select…';
      input.append(placeholder);
      for (const option of field.options ?? []) {
        const choice = document.createElement('option');
        choice.value = option;
        choice.textContent = option;
        input.append(choice);
      }
    }
    label.append(input);
    form.append(label);
  }
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Save record';
  form.append(submit);
}

function bindEvents(): void {
  byId('record-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!definition || !service) return;
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const record: WbiRecord = {};
    for (const field of definition.fields) {
      const raw = String(data.get(field.key) ?? '').trim();
      record[field.key] = field.kind === 'number' ? (raw ? Number(raw) : null) : (raw || null);
    }
    try {
      await service.create(record, definition.fields, (item) => ({
        resource: definition!.queue.resource,
        method: 'POST',
        path: definition!.queue.path,
        payload: definition!.queue.payload(item),
      }));
      form.reset();
      currentPage = 1;
      showNotice('Record staged in the workbook queue. Submit it with the secured WBI queue tool.');
      await refresh();
    } catch (error) { showNotice(errorMessage(error), true); }
  });
  byId('refresh').addEventListener('click', () => { currentPage = 1; void refresh(); });
  byId('search').addEventListener('input', () => { currentPage = 1; void refresh(); });
  byId('previous').addEventListener('click', () => { currentPage -= 1; void refresh(); });
  byId('next').addEventListener('click', () => { currentPage += 1; void refresh(); });
}

async function refresh(): Promise<void> {
  if (!definition || !service) return;
  try {
    const page = await service.page((byId('search') as HTMLInputElement).value, currentPage);
    currentPage = page.page;
    byId('record-head').replaceChildren();
    const headerRow = document.createElement('tr');
    for (const name of definition.columns) {
      const th = document.createElement('th'); th.scope = 'col'; th.textContent = name; headerRow.append(th);
    }
    byId('record-head').append(headerRow);
    const body = byId('record-body');
    body.replaceChildren();
    for (const record of page.items) {
      const row = document.createElement('tr');
      for (const name of definition.columns) {
        const cell = document.createElement('td'); cell.textContent = String(record[name] ?? ''); row.append(cell);
      }
      body.append(row);
    }
    if (!page.items.length) {
      const row = document.createElement('tr'); const cell = document.createElement('td');
      cell.colSpan = definition.columns.length; cell.textContent = 'No records found.'; row.append(cell); body.append(row);
    }
    byId('page-label').textContent = `Page ${page.page} of ${page.totalPages} · ${page.totalItems} records`;
    (byId('previous') as HTMLButtonElement).disabled = page.page <= 1;
    (byId('next') as HTMLButtonElement).disabled = page.page >= page.totalPages;
    if (!page.totalItems) showNotice(`Ready. Create the ${definition.table} table on this worksheet to connect the form.`);
  } catch (error) { showNotice(errorMessage(error), true); }
}

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing task pane element: ${id}`);
  return element;
}

function showNotice(message: string, isError = false): void {
  const notice = byId('notice'); notice.textContent = message; notice.classList.toggle('error', isError);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
