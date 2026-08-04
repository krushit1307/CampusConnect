import { Readable, pipeline } from "node:stream";
import { promisify } from "node:util";
import { CSVStreamParser } from "../lib/streams/csvParserStream";
import { UserImportStreamProcessor } from "../lib/streams/userImportStreamProcessor";
import {
  BulkImportOptions,
  BulkImportSummary,
  FailedRowReport,
} from "../lib/validations/bulkImportValidation";
import { UserImportRepository } from "../lib/db/userImportRepository";

const streamPipeline = promisify(pipeline);

export class BulkImportService {
  private dbRepository: UserImportRepository;

  constructor(dbRepository?: UserImportRepository) {
    this.dbRepository = dbRepository || new UserImportRepository();
  }

  /**
   * Processes an incoming readable stream (e.g. HTTP request multipart upload or file stream)
   * utilizing memory-efficient Node.js Streams without buffering the full file into memory.
   */
  public async processUserImportStream(
    inputStream: Readable,
    options: BulkImportOptions = {},
  ): Promise<BulkImportSummary> {
    const csvParser = new CSVStreamParser();
    const streamProcessor = new UserImportStreamProcessor(options, this.dbRepository);

    await streamPipeline(inputStream, csvParser, streamProcessor);

    return streamProcessor.getImportSummary();
  }

  /**
   * Helper to turn a Buffer or string into a Node.js Readable stream and process in 500-row chunks
   */
  public async processUserImportBuffer(
    bufferOrString: Buffer | string,
    options: BulkImportOptions = {},
  ): Promise<BulkImportSummary> {
    const chunkSize = 64 * 1024; // 64KB chunks to simulate streaming
    const content =
      typeof bufferOrString === "string" ? Buffer.from(bufferOrString, "utf8") : bufferOrString;

    let offset = 0;
    const readableStream = new Readable({
      read() {
        if (offset >= content.length) {
          this.push(null);
        } else {
          const chunk = content.subarray(offset, offset + chunkSize);
          offset += chunkSize;
          this.push(chunk);
        }
      },
    });

    return this.processUserImportStream(readableStream, options);
  }

  /**
   * Generates a downloadable CSV string containing failed rows and their specific validation errors
   */
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

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }
}
