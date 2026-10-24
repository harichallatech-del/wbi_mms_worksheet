import type { QueueCommand, WbiRecord } from '../../domain/records';

export interface RecordRepository<T extends WbiRecord> {
  list(): Promise<readonly T[]>;
  enqueue(command: QueueCommand): Promise<void>;
}
