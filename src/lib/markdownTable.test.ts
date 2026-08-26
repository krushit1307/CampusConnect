import { describe, it, expect } from "vitest";
import {
  createEmptyTable,
  sanitizeCellForMarkdown,
  tableToMarkdown,
  MAX_TABLE_DIMENSION,
  MIN_TABLE_DIMENSION,
} from "./markdownTable";

// ---------------------------------------------------------------------------
// createEmptyTable
// ---------------------------------------------------------------------------
describe("createEmptyTable", () => {
  it("defaults to a 3x3 grid of empty strings", () => {
    const table = createEmptyTable();
    expect(table).toHaveLength(3);
    expect(table.every((row) => row.length === 3 && row.every((cell) => cell === ""))).toBe(true);
  });

  it("respects custom dimensions", () => {
    const table = createEmptyTable(2, 5);
    expect(table).toHaveLength(2);
    expect(table[0]).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// sanitizeCellForMarkdown
// ---------------------------------------------------------------------------
describe("sanitizeCellForMarkdown", () => {
  it("trims surrounding whitespace", () => {
    expect(sanitizeCellForMarkdown("  hello  ")).toBe("hello");
  });

  it("converts line breaks to <br> since GFM table cells can't hold real newlines", () => {
    expect(sanitizeCellForMarkdown("line one\nline two")).toBe("line one<br>line two");
  });

  it("normalizes CRLF and lone CR line endings too", () => {
    expect(sanitizeCellForMarkdown("a\r\nb\rc")).toBe("a<br>b<br>c");
  });

  it("escapes pipe characters so they don't break the column structure", () => {
    expect(sanitizeCellForMarkdown("A | B")).toBe("A \\| B");
  });

  it("handles both line breaks and pipes together", () => {
    expect(sanitizeCellForMarkdown("a|b\nc|d")).toBe("a\\|b<br>c\\|d");
  });
});

// ---------------------------------------------------------------------------
// tableToMarkdown
// ---------------------------------------------------------------------------
describe("tableToMarkdown", () => {
  it("returns an empty string for an empty grid", () => {
    expect(tableToMarkdown([])).toBe("");
  });

  it("returns an empty string for a grid with zero columns", () => {
    expect(tableToMarkdown([[]])).toBe("");
  });

  it("builds a valid header + separator + body structure", () => {
    const md = tableToMarkdown([
      ["Name", "Role"],
      ["Alice", "Admin"],
    ]);
    const lines = md.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^\|.*Name.*Role.*\|$/);
    expect(lines[1]).toMatch(/^\|[\s-]+\|[\s-]+\|$/); // separator row is only dashes/spaces/pipes
  });

  it("pads every column to the same width so pipes line up visually", () => {
    const md = tableToMarkdown([
      ["A", "Longheader"],
      ["Somewhatlong", "x"],
    ]);
    const lines = md.split("\n");
    // Every line should be the exact same character length when padded correctly.
    const lengths = new Set(lines.map((l) => l.length));
    expect(lengths.size).toBe(1);
  });

  it("produces a header-only table (no body rows) for a single-row grid", () => {
    const md = tableToMarkdown([["Only", "Header"]]);
    expect(md.split("\n")).toHaveLength(2); // header + separator, no body
  });

  it("escapes pipes and converts newlines inside cells", () => {
    const md = tableToMarkdown([
      ["Header"],
      ["a|b\nc"],
    ]);
    expect(md).toContain("a\\|b<br>c");
    expect(md).not.toMatch(/a\|b/); // the raw unescaped pipe must not survive
  });

  it("treats missing/undefined cells in a ragged row as empty strings", () => {
    // Defensive: if a row is shorter than the header for any reason, don't crash.
    const md = tableToMarkdown([
      ["A", "B", "C"],
      ["1"],
    ]);
    expect(() => md).not.toThrow();
    expect(md.split("\n")).toHaveLength(3);
  });

  it("uses at least width 3 for the separator dashes, per common GFM style", () => {
    const md = tableToMarkdown([["A"], ["1"]]);
    const separatorLine = md.split("\n")[1];
    expect(separatorLine).toBe("| --- |");
  });

  it("respects the documented min/max table dimension constants", () => {
    expect(MIN_TABLE_DIMENSION).toBe(1);
    expect(MAX_TABLE_DIMENSION).toBe(10);
  });

  it("handles a full 10x10 table without error", () => {
    const grid = Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => `r${r}c${c}`),
    );
    const md = tableToMarkdown(grid);
    expect(md.split("\n")).toHaveLength(11); // header + separator + 9 body rows
  });
});
