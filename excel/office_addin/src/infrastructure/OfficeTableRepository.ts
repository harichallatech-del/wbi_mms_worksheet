import type { RecordRepository } from '../application/ports/RecordRepository';
import type { QueueCommand, WbiRecord } from '../domain/records';

export class OfficeTableRepository<T extends WbiRecord> implements RecordRepository<T> {
  constructor(private readonly worksheetName: string, private readonly tableName: string) {}

  async list(): Promise<readonly T[]> {
    return Excel.run(async (context) => {
      const worksheet = context.workbook.worksheets.getItem(this.worksheetName);
      const table = worksheet.tables.getItemOrNullObject(this.tableName);
      table.load('name');
      await context.sync();
      if (table.isNullObject) throw new Error(`Create an Excel table named ${this.tableName} on this worksheet first.`);
      const headers = table.getHeaderRowRange();
      const body = table.getDataBodyRange();
      headers.load('values');
      body.load('values');
      await context.sync();
      const keys = (headers.values[0] ?? []).map(String);
      return body.values.map((row) => Object.fromEntries(keys.map((key, index) => [key, row[index] as T[string]])) as T);
    });
  }

  async enqueue(command: QueueCommand): Promise<void> {
    await Excel.run(async (context) => {
      const worksheet = context.workbook.worksheets.getItem(this.worksheetName);
      const queue = worksheet.getRangeByIndexes(1, 44, 2000, 9);
      queue.load('values');
      await context.sync();
      const index = queue.values.findIndex((row) => !String(row[0] ?? '').trim() && !String(row[6] ?? '').trim());
      if (index < 0) throw new Error('The request queue is full. Archive completed requests before adding more.');
      const id = `WBI-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${index + 1}`;
      const values = [id, new Date().toISOString(), command.resource, command.method, command.path, JSON.stringify(command.payload), 'PENDING', '', ''];
      worksheet.getRangeByIndexes(index + 1, 44, 1, 9).values = [values];
      await context.sync();
    });
  }
}
