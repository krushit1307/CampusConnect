import { BulkImportService } from "./bulkImportService";
import { BulkImportSummary } from "../lib/validations/bulkImportValidation";
import { UserImportRepository } from "../lib/db/userImportRepository";

export interface ApiImportResponse {
  status: number;
  statusText: string;
  data: BulkImportSummary & {
    message: string;
  };
}

/**
 * Handles POST /api/admin/users/import API requests
 */
export async function handleBulkUserImportApiRequest(
  csvContent: string | Uint8Array,
  batchSize: number = 500,
): Promise<ApiImportResponse> {
  try {
    const repository = new UserImportRepository();
    const service = new BulkImportService(repository);

    const summary = await service.processUserImportBuffer(csvContent, {
      batchSize,
      maxFailedRowsLog: 500,
    });

    const isPartialSuccess = summary.failedCount > 0 && summary.insertedCount > 0;
    const isFullSuccess = summary.failedCount === 0;

    let message = "Bulk user import completed successfully.";
    let status = 200;

    if (isPartialSuccess) {
      status = 207; // Multi-Status / Partial Content
      message = `Partial import completed: ${summary.insertedCount} users imported, ${summary.failedCount} rows failed.`;
    } else if (!isFullSuccess && summary.insertedCount === 0) {
      status = 400;
      message = `Import failed completely: 0 users imported, ${summary.failedCount} rows failed.`;
    }

    return {
      status,
      statusText: isFullSuccess ? "OK" : isPartialSuccess ? "Partial Success" : "Bad Request",
      data: {
        ...summary,
        message,
      },
    };
  } catch (error: any) {
    return {
      status: 500,
      statusText: "Internal Server Error",
      data: {
        success: false,
        totalProcessed: 0,
        insertedCount: 0,
        failedCount: 0,
        failedRows: [],
        executionTimeMs: 0,
        batchSize,
        memoryMetrics: { initialHeapMB: 0, peakHeapMB: 0, finalHeapMB: 0 },
        message: `Server stream processing error: ${error?.message || "Unknown error"}`,
      },
    };
  }
}
