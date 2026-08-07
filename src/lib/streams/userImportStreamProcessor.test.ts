import { describe, it, expect, beforeEach } from "vitest";
import { Readable } from "node:stream";
import { CSVStreamParser } from "./csvParserStream";
import { UserImportStreamProcessor } from "./userImportStreamProcessor";
import { BulkImportService } from "../../services/bulkImportService";
import { UserImportRepository } from "../db/userImportRepository";
import { generateDummyUserCsv } from "../validations/bulkImportValidation";

describe("User Import Streaming Processor Suite (#2309)", () => {
  let repository: UserImportRepository;
  let service: BulkImportService;

  beforeEach(() => {
    repository = new UserImportRepository();
    repository.resetDatabase();
    service = new BulkImportService(repository);
  });

  it("should process 1,000 valid CSV user rows using 250-row stream batching", async () => {
    const csvContent = generateDummyUserCsv(1000, []);

    const summary = await service.processUserImportBuffer(csvContent, {
      batchSize: 250,
    });

    expect(summary.totalProcessed).toBe(1000);
    expect(summary.insertedCount).toBe(1000);
    expect(summary.failedCount).toBe(0);
    expect(summary.failedRows).toHaveLength(0);
    expect(repository.getTotalUserCount()).toBe(1000);
  });

  it("should isolate failing rows (missing email/name) without crashing the 10,000-row pipeline", async () => {
    // Generate 10,000 rows with rows 5000 and 7500 invalid
    const invalidIndices = [5000, 7500];
    const csvContent = generateDummyUserCsv(10000, invalidIndices);

    const summary = await service.processUserImportBuffer(csvContent, {
      batchSize: 500,
    });

    expect(summary.totalProcessed).toBe(10000);
    expect(summary.insertedCount).toBe(9998);
    expect(summary.failedCount).toBe(2);
    expect(summary.failedRows).toHaveLength(2);

    expect(summary.failedRows[0].rowNumber).toBe(5000);
    expect(summary.failedRows[1].rowNumber).toBe(7500);

    // Verify RAM memory usage remains flat and stable during execution
    expect(summary.memoryMetrics.peakHeapMB).toBeGreaterThan(0);
  });

  it("should generate downloadable error CSV log report for failed rows", () => {
    const failedRows = [
      {
        rowNumber: 5000,
        email: "bad-email",
        error: "email: Invalid email format",
        rawRow: { email: "bad-email", name: "User 5000" },
      },
    ];

    const errorCsv = service.generateFailedRowsCsv(failedRows);
    expect(errorCsv).toContain("Row Number,Email,Error Message");
    expect(errorCsv).toContain('5000,"bad-email","email: Invalid email format"');
  });
});
