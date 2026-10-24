import type { FieldDefinition, Page, QueueCommand, WbiRecord } from '../domain/records';
import { PaginatedQuery } from './PaginatedQuery';
import type { RecordRepository } from './ports/RecordRepository';

export class RecordService<T extends WbiRecord> {
  private readonly pagination = new PaginatedQuery<T>(10);

  constructor(private readonly repository: RecordRepository<T>) {}

  async page(search: string, pageNumber: number): Promise<Page<T>> {
    const needle = search.trim().toLocaleLowerCase();
    const rows = await this.repository.list();
    const filtered = needle
      ? rows.filter((record) => Object.values(record).some((value) => String(value ?? '').toLocaleLowerCase().includes(needle)))
      : rows;
    return this.pagination.execute(filtered, pageNumber);
  }

  async create(record: T, fields: readonly FieldDefinition[], toCommand: (record: T) => QueueCommand): Promise<void> {
    for (const field of fields) {
      const value = record[field.key];
      if (field.required && (value === null || String(value ?? '').trim() === '')) {
        throw new Error(`${field.label} is required.`);
      }
      if (typeof value === 'number' && (!Number.isFinite(value) || (field.min !== undefined && value < field.min))) {
        throw new Error(`${field.label} must be ${field.min === undefined ? 'a finite number' : `at least ${field.min}`}.`);
      }
    }
    await this.repository.enqueue(toCommand(record));
  }
}
