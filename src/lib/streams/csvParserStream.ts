import { Transform, TransformCallback } from "node:stream";
import { normalizeCsvHeaderKeys, RawUserCsvRow } from "../validations/bulkImportValidation";

export interface ParsedCsvRowRecord {
  rowNumber: number;
  data: RawUserCsvRow;
}

export class CSVStreamParser extends Transform {
  private bufferRemainder: string = "";
  private headerColumns: string[] | null = null;
  private currentRowIndex: number = 0;
  private delimiter: string = ",";

  constructor(delimiter: string = ",") {
    super({ objectMode: true });
    this.delimiter = delimiter;
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      const textChunk = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      this.bufferRemainder += textChunk;

      const lines = this.extractLines();

      for (const line of lines) {
        if (!line.trim()) continue;

        const fields = this.parseCsvLine(line);

        if (!this.headerColumns) {
          // First non-empty row is treated as header
          this.headerColumns = fields.map((f) => f.trim());
          continue;
        }

        this.currentRowIndex++;
        const rawRowObj: RawUserCsvRow = {};

        for (let i = 0; i < this.headerColumns.length; i++) {
          const colName = this.headerColumns[i];
          rawRowObj[colName] = fields[i] !== undefined ? fields[i].trim() : "";
        }

        const normalizedRow = normalizeCsvHeaderKeys(rawRowObj);
        const record: ParsedCsvRowRecord = {
          rowNumber: this.currentRowIndex,
          data: normalizedRow,
        };

        this.push(record);
      }

      callback();
    } catch (err: any) {
      callback(err);
    }
  }

  _flush(callback: TransformCallback): void {
    try {
      if (this.bufferRemainder.trim()) {
        const line = this.bufferRemainder.trim();
        if (this.headerColumns && line) {
          const fields = this.parseCsvLine(line);
          this.currentRowIndex++;
          const rawRowObj: RawUserCsvRow = {};

          for (let i = 0; i < this.headerColumns.length; i++) {
            const colName = this.headerColumns[i];
            rawRowObj[colName] = fields[i] !== undefined ? fields[i].trim() : "";
          }

          const normalizedRow = normalizeCsvHeaderKeys(rawRowObj);
          this.push({
            rowNumber: this.currentRowIndex,
            data: normalizedRow,
          });
        }
      }
      callback();
    } catch (err: any) {
      callback(err);
    }
  }

  /**
   * Splits raw text buffer into lines, keeping incomplete quotes intact in bufferRemainder
   */
  private extractLines(): string[] {
    const lines: string[] = [];
    let currentLine = "";
    let insideQuote = false;

    for (let i = 0; i < this.bufferRemainder.length; i++) {
      const char = this.bufferRemainder[i];
      const nextChar = this.bufferRemainder[i + 1];

      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          currentLine += '"';
          i++; // skip escaped quote
        } else {
          insideQuote = !insideQuote;
          currentLine += char;
        }
      } else if ((char === "\n" || (char === "\r" && nextChar === "\n")) && !insideQuote) {
        if (char === "\r") i++; // skip \r
        lines.push(currentLine);
        currentLine = "";
      } else {
        currentLine += char;
      }
    }

    this.bufferRemainder = currentLine;
    return lines;
  }

  /**
   * Parses a single CSV line respecting quotes and delimiter
   */
  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let currentField = "";
    let insideQuote = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === this.delimiter && !insideQuote) {
        fields.push(currentField);
        currentField = "";
      } else {
        currentField += char;
      }
    }

    fields.push(currentField);
    return fields;
  }
}
