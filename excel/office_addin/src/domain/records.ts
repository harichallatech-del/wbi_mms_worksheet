export type CellValue = string | number | boolean | null;
export type WbiRecord = Record<string, CellValue>;
export type FieldKind = 'text' | 'number' | 'date' | 'time' | 'select';

export interface FieldDefinition {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly required?: boolean;
  readonly min?: number;
  readonly options?: readonly string[];
}

export interface ScreenDefinition {
  readonly worksheet: string;
  readonly table: string;
  readonly title: string;
  readonly fields: readonly FieldDefinition[];
  readonly columns: readonly string[];
  readonly queue: {
    readonly resource: string;
    readonly path: string;
    readonly payload: (record: WbiRecord) => WbiRecord;
  };
}

export interface QueueCommand {
  readonly resource: string;
  readonly method: 'POST';
  readonly path: string;
  readonly payload: WbiRecord;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}
