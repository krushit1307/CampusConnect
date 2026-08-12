import {
  BulkImportOptions,
  BulkImportSummary,
  BulkUserRowSchema,
  FailedRowReport,
  ValidatedUserRow,
} from "../validations/bulkImportValidation";
import { UserImportRepository } from "../db/userImportRepository";
import { ParsedCsvRowRecord } from "./csvParserStream";

/** Batch processor shared by browser Web Streams and buffered imports. */
export class UserImportStreamProcessor {
  private batchBuffer: ValidatedUserRow[] = [];
  private readonly batchSize: number;
  private readonly maxFailedRowsLog: number;
  private totalProcessed = 0;
  private insertedCount = 0;
  private failedCount = 0;
  private failedRows: FailedRowReport[] = [];
  private readonly startTime = Date.now();
  private readonly initialHeapMB = this.getMemoryHeapMB();
  private peakHeapMB = this.initialHeapMB;

  constructor(
    options: BulkImportOptions = {},
    private readonly dbRepository: UserImportRepository = new UserImportRepository(),
  ) {
    this.batchSize = options.batchSize || 500;
    this.maxFailedRowsLog = options.maxFailedRowsLog || 200;
  }

  public async process(record: ParsedCsvRowRecord): Promise<void> {
    this.totalProcessed += 1;
    this.updatePeakMemory();

    const validationResult = BulkUserRowSchema.safeParse(record.data);
    if (!validationResult.success) {
      this.failedCount += 1;
      if (this.failedRows.length < this.maxFailedRowsLog) {
        this.failedRows.push({
          rowNumber: record.rowNumber,
          email: record.data.email || undefined,
          error: validationResult.error.errors
            .map((error) => `${error.path.join(".")}: ${error.message}`)
            .join("; "),
          rawRow: record.data,
        });
      }
      return;
    }

    this.batchBuffer.push({
      ...validationResult.data,
      rowNumber: record.rowNumber,
      importedAt: new Date().toISOString(),
    });

    if (this.batchBuffer.length >= this.batchSize) await this.flushBatchBuffer();
  }

  public async finish(): Promise<void> {
    await this.flushBatchBuffer();
    this.updatePeakMemory();
  }

  private getMemoryHeapMB(): number {
    if (typeof process === "undefined" || !process.memoryUsage) return 0;
    return Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;
  }

  private updatePeakMemory(): void {
    this.peakHeapMB = Math.max(this.peakHeapMB, this.getMemoryHeapMB());
  }

  private async flushBatchBuffer(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    const currentBatch = this.batchBuffer;
    this.batchBuffer = [];
    const result = await this.dbRepository.bulkInsertUsers(currentBatch);
    this.insertedCount += result.inserted;
    this.failedCount += result.failed.length;

    for (const failedItem of result.failed) {
      if (this.failedRows.length >= this.maxFailedRowsLog) break;
      this.failedRows.push({
        rowNumber: failedItem.rowNumber,
        email: failedItem.email,
        error: failedItem.error,
        rawRow: failedItem.rawRow,
      });
    }

    this.updatePeakMemory();
  }

  public getImportSummary(): BulkImportSummary {
    const finalHeapMB = this.getMemoryHeapMB();
    return {
      success: this.failedCount === 0,
      totalProcessed: this.totalProcessed,
      insertedCount: this.insertedCount,
      failedCount: this.failedCount,
      failedRows: this.failedRows,
      executionTimeMs: Date.now() - this.startTime,
      batchSize: this.batchSize,
      memoryMetrics: {
        initialHeapMB: this.initialHeapMB,
        peakHeapMB: Math.max(this.peakHeapMB, finalHeapMB),
        finalHeapMB,
      },
    };
  }
}
