import { Writable, WritableCallback } from "node:stream";
import {
  BulkImportOptions,
  BulkImportSummary,
  BulkUserRowSchema,
  FailedRowReport,
  ValidatedUserRow,
} from "../validations/bulkImportValidation";
import { UserImportRepository } from "../db/userImportRepository";
import { ParsedCsvRowRecord } from "./csvParserStream";

export class UserImportStreamProcessor extends Writable {
  private batchBuffer: ValidatedUserRow[] = [];
  private batchSize: number = 500;
  private maxFailedRowsLog: number = 200;

  private totalProcessed: number = 0;
  private insertedCount: number = 0;
  private failedCount: number = 0;
  private failedRows: FailedRowReport[] = [];

  private startTime: number = 0;
  private initialHeapMB: number = 0;
  private peakHeapMB: number = 0;

  private dbRepository: UserImportRepository;

  constructor(options: BulkImportOptions = {}, dbRepository?: UserImportRepository) {
    super({ objectMode: true });
    this.batchSize = options.batchSize || 500;
    this.maxFailedRowsLog = options.maxFailedRowsLog || 200;
    this.dbRepository = dbRepository || new UserImportRepository();

    this.startTime = Date.now();
    this.initialHeapMB = this.getMemoryHeapMB();
    this.peakHeapMB = this.initialHeapMB;
  }

  private getMemoryHeapMB(): number {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const bytes = process.memoryUsage().heapUsed;
      return Math.round((bytes / 1024 / 1024) * 100) / 100;
    }
    return 0;
  }

  private updatePeakMemory(): void {
    const currentHeap = this.getMemoryHeapMB();
    if (currentHeap > this.peakHeapMB) {
      this.peakHeapMB = currentHeap;
    }
  }

  _write(chunk: ParsedCsvRowRecord, encoding: BufferEncoding, callback: WritableCallback): void {
    this.totalProcessed++;
    this.updatePeakMemory();

    const { rowNumber, data } = chunk;

    // Validate incoming CSV row using Zod
    const validationResult = BulkUserRowSchema.safeParse(data);

    if (!validationResult.success) {
      this.failedCount++;
      const errorMessage = validationResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");

      if (this.failedRows.length < this.maxFailedRowsLog) {
        this.failedRows.push({
          rowNumber,
          email: data.email || undefined,
          error: errorMessage,
          rawRow: data,
        });
      }

      callback();
      return;
    }

    const validatedUser: ValidatedUserRow = {
      ...validationResult.data,
      rowNumber,
      importedAt: new Date().toISOString(),
    };

    this.batchBuffer.push(validatedUser);

    // If batch buffer reaches batch threshold (500 rows), execute bulk database insertion
    if (this.batchBuffer.length >= this.batchSize) {
      this.flushBatchBuffer()
        .then(() => callback())
        .catch((err) => callback(err));
    } else {
      callback();
    }
  }

  _final(callback: WritableCallback): void {
    // Flush remaining buffer rows in stream final step
    if (this.batchBuffer.length > 0) {
      this.flushBatchBuffer()
        .then(() => {
          this.updatePeakMemory();
          callback();
        })
        .catch((err) => callback(err));
    } else {
      this.updatePeakMemory();
      callback();
    }
  }

  /**
   * Flushes accumulated 500-row batch buffer into database repository
   */
  private async flushBatchBuffer(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    const currentBatch = [...this.batchBuffer];
    this.batchBuffer = []; // Clear RAM buffer immediately for memory safety

    const result = await this.dbRepository.bulkInsertUsers(currentBatch);
    this.insertedCount += result.inserted;

    if (result.failed.length > 0) {
      this.failedCount += result.failed.length;
      for (const failedItem of result.failed) {
        if (this.failedRows.length < this.maxFailedRowsLog) {
          this.failedRows.push({
            rowNumber: failedItem.rowNumber,
            email: failedItem.email,
            error: failedItem.error,
            rawRow: failedItem.rawRow,
          });
        }
      }
    }

    this.updatePeakMemory();
  }

  /**
   * Returns final execution metrics & stream import summary report
   */
  public getImportSummary(): BulkImportSummary {
    const finalHeapMB = this.getMemoryHeapMB();
    const executionTimeMs = Date.now() - this.startTime;

    return {
      success: this.failedCount === 0,
      totalProcessed: this.totalProcessed,
      insertedCount: this.insertedCount,
      failedCount: this.failedCount,
      failedRows: this.failedRows,
      executionTimeMs,
      batchSize: this.batchSize,
      memoryMetrics: {
        initialHeapMB: this.initialHeapMB,
        peakHeapMB: Math.max(this.peakHeapMB, finalHeapMB),
        finalHeapMB,
      },
    };
  }
}
