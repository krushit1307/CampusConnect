import { describe, it, expect } from "vitest";
import {
  applyTextOperation,
  transformOperation,
  canEditDocument,
  formatNotesExport,
  generateUserCursorColor,
  NoteTextOperation,
} from "./collaborativeNotes";

describe("Live Collaborative Notes Engine (#3564)", () => {
  it("applies insert, delete, and replace text operations correctly", () => {
    let text = "Hello world";

    // Insert "beautiful " at position 6
    const insertOp: NoteTextOperation = {
      id: "op-1",
      userId: "u-1",
      userName: "Alex",
      type: "insert",
      position: 6,
      text: "beautiful ",
      version: 1,
      timestamp: Date.now(),
    };
    text = applyTextOperation(text, insertOp);
    expect(text).toBe("Hello beautiful world");

    // Delete "beautiful " (10 chars) from position 6
    const deleteOp: NoteTextOperation = {
      id: "op-2",
      userId: "u-2",
      userName: "Sam",
      type: "delete",
      position: 6,
      text: "",
      length: 10,
      version: 2,
      timestamp: Date.now(),
    };
    text = applyTextOperation(text, deleteOp);
    expect(text).toBe("Hello world");

    // Replace "world" with "CampusConnect"
    const replaceOp: NoteTextOperation = {
      id: "op-3",
      userId: "u-1",
      userName: "Alex",
      type: "replace",
      position: 6,
      text: "CampusConnect",
      length: 5,
      version: 3,
      timestamp: Date.now(),
    };
    text = applyTextOperation(text, replaceOp);
    expect(text).toBe("Hello CampusConnect");
  });

  it("transforms concurrent operations by shifting positions", () => {
    // Op A wants to insert at index 10
    const opA: NoteTextOperation = {
      id: "op-a",
      userId: "u-1",
      userName: "Alex",
      type: "insert",
      position: 10,
      text: "Note",
      version: 1,
      timestamp: Date.now(),
    };

    // Op B already inserted 5 chars at index 2
    const opB: NoteTextOperation = {
      id: "op-b",
      userId: "u-2",
      userName: "Sam",
      type: "insert",
      position: 2,
      text: "12345",
      version: 1,
      timestamp: Date.now(),
    };

    const transformedA = transformOperation(opA, opB);
    expect(transformedA.position).toBe(15); // 10 + 5
    expect(transformedA.version).toBe(2);
  });

  it("enforces freeze state and post-event lock constraints", () => {
    expect(canEditDocument(false)).toBe(true);
    expect(canEditDocument(true)).toBe(false);

    // Event ended 5 hours ago -> frozen
    const pastEventEnd = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    expect(canEditDocument(false, pastEventEnd)).toBe(false);
  });

  it("formats study guide export with contributors list and markdown header", () => {
    const rawContent = "## Key Takeaways\n- Quantum algorithms speed up factoring.";
    const exported = formatNotesExport(rawContent, "Quantum Computing Lecture", ["Alex", "Sam"]);

    expect(exported).toContain("# 📚 Study Guide: Quantum Computing Lecture");
    expect(exported).toContain("Compiled collaboratively by Alex, Sam");
    expect(exported).toContain("Quantum algorithms speed up factoring.");
  });

  it("generates stable hex colors for user cursors", () => {
    const colorAlex = generateUserCursorColor("user-alex-123");
    expect(colorAlex).toMatch(/^#[0-9a-fA-F]{6}$/);

    const colorSame = generateUserCursorColor("user-alex-123");
    expect(colorAlex).toBe(colorSame);
  });
});
