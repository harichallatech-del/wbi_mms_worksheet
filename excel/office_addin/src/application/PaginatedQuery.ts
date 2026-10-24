import type { Page } from '../domain/records';

export class PaginatedQuery<T> {
  constructor(private readonly pageSize: number) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new RangeError('Page size must be between 1 and 100.');
    }
  }

  execute(items: readonly T[], requestedPage: number): Page<T> {
    const totalPages = Math.max(1, Math.ceil(items.length / this.pageSize));
    const page = Math.min(totalPages, Math.max(1, Math.floor(requestedPage)));
    const start = (page - 1) * this.pageSize;
    return {
      items: items.slice(start, start + this.pageSize),
      page,
      pageSize: this.pageSize,
      totalItems: items.length,
      totalPages,
    };
  }
}
