import { CSVStreamParser } from "../lib/streams/csvParserStream";
import { UserImportStreamProcessor } from "../lib/streams/userImportStreamProcessor";
import {
  BulkImportOptions,
  BulkImportSummary,
  FailedRowReport,
} from "../lib/validations/bulkImportValidation";
import { UserImportRepository } from "../lib/db/userImportRepository";

export class BulkImportService {
  constructor(private readonly dbRepository = new UserImportRepository()) {}

  /** Process a browser-native Web ReadableStream without bundling Node stream shims. */
  public async processUserImportStream(
    inputStream: ReadableStream<Uint8Array | string>,
    options: BulkImportOptions = {},
  ): Promise<BulkImportSummary> {
    const parser = new CSVStreamParser();
    const processor = new UserImportStreamProcessor(options, this.dbRepository);
    const reader = inputStream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const record of parser.write(value)) await processor.process(record);
      }

      for (const record of parser.finish()) await processor.process(record);
      await processor.finish();
      return processor.getImportSummary();
    } finally {
      reader.releaseLock();
    }
  }

  /** Process strings, Buffers, and Uint8Arrays in bounded chunks. */
  public async processUserImportBuffer(
    content: string | Uint8Array,
    options: BulkImportOptions = {},
  ): Promise<BulkImportSummary> {
    const parser = new CSVStreamParser();
    const processor = new UserImportStreamProcessor(options, this.dbRepository);
    const chunkSize = 64 * 1024;

    for (let offset = 0; offset < content.length; offset += chunkSize) {
      for (const record of parser.write(content.slice(offset, offset + chunkSize))) {
        await processor.process(record);
      }
    }

    for (const record of parser.finish()) await processor.process(record);
    await processor.finish();
    return processor.getImportSummary();
  }

  public generateFailedRowsCsv(failedRows: FailedRowReport[]): string {
    const headers = ["Row Number", "Email", "Error Message", "Raw Email", "Raw Name", "Raw Role"];
    const rows = failedRows.map((item) => [
      item.rowNumber.toString(),
      `"${(item.email || "").replace(/"/g, '""')}"`,
      `"${item.error.replace(/"/g, '""')}"`,
      `"${(item.rawRow.email || "").replace(/"/g, '""')}"`,
      `"${(item.rawRow.name || "").replace(/"/g, '""')}"`,
      `"${(item.rawRow.role || "").replace(/"/g, '""')}"`,
    ]);

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }
}
