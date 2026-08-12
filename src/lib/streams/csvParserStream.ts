import { normalizeCsvHeaderKeys, RawUserCsvRow } from "../validations/bulkImportValidation";

export interface ParsedCsvRowRecord {
  rowNumber: number;
  data: RawUserCsvRow;
}

/** Incremental CSV parser that works in browsers and Node without Node streams. */
export class CSVStreamParser {
  private bufferRemainder = "";
  private headerColumns: string[] | null = null;
  private currentRowIndex = 0;
  private readonly delimiter: string;
  private readonly decoder = new TextDecoder();

  constructor(delimiter = ",") {
    this.delimiter = delimiter;
  }

  public write(chunk: string | Uint8Array): ParsedCsvRowRecord[] {
    this.bufferRemainder +=
      typeof chunk === "string" ? chunk : this.decoder.decode(chunk, { stream: true });

    return this.extractLines().flatMap((line) => this.parseRecord(line));
  }

  public finish(): ParsedCsvRowRecord[] {
    this.bufferRemainder += this.decoder.decode();
    const finalLine = this.bufferRemainder;
    this.bufferRemainder = "";
    return this.parseRecord(finalLine);
  }

  private parseRecord(line: string): ParsedCsvRowRecord[] {
    if (!line.trim()) return [];

    const fields = this.parseCsvLine(line);
    if (!this.headerColumns) {
      this.headerColumns = fields.map((field) => field.trim());
      return [];
    }

    this.currentRowIndex += 1;
    const rawRow: RawUserCsvRow = {};
    for (let index = 0; index < this.headerColumns.length; index += 1) {
      rawRow[this.headerColumns[index]] = fields[index]?.trim() ?? "";
    }

    return [
      {
        rowNumber: this.currentRowIndex,
        data: normalizeCsvHeaderKeys(rawRow),
      },
    ];
  }

  /** Split complete rows while retaining a quoted/incomplete row for the next chunk. */
  private extractLines(): string[] {
    const lines: string[] = [];
    let currentLine = "";
    let insideQuote = false;

    for (let index = 0; index < this.bufferRemainder.length; index += 1) {
      const char = this.bufferRemainder[index];
      const nextChar = this.bufferRemainder[index + 1];

      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          currentLine += '""';
          index += 1;
        } else {
          insideQuote = !insideQuote;
          currentLine += char;
        }
      } else if ((char === "\n" || (char === "\r" && nextChar === "\n")) && !insideQuote) {
        if (char === "\r") index += 1;
        lines.push(currentLine);
        currentLine = "";
      } else {
        currentLine += char;
      }
    }

    this.bufferRemainder = currentLine;
    return lines;
  }

  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let currentField = "";
    let insideQuote = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"') {
        if (insideQuote && nextChar === '"') {
          currentField += '"';
          index += 1;
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
