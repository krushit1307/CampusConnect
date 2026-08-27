import { describe, it, expect } from "vitest";
import { insertMarkdownBlock } from "./insertMarkdownBlock";

describe("insertMarkdownBlock", () => {
  it("inserts with no leading/trailing gap into an empty document", () => {
    const { nextValue, cursorPosition } = insertMarkdownBlock("", 0, 0, "TABLE");
    expect(nextValue).toBe("TABLE");
    expect(cursorPosition).toBe("TABLE".length);
  });

  it("adds a blank line before when inserting right after existing text", () => {
    const { nextValue } = insertMarkdownBlock("Hello", 5, 5, "TABLE");
    expect(nextValue).toBe("Hello\n\nTABLE");
  });

  it("adds only one newline (not two) when already at the start of a fresh line", () => {
    const { nextValue } = insertMarkdownBlock("Hello\n", 6, 6, "TABLE");
    expect(nextValue).toBe("Hello\n\nTABLE");
  });

  it("adds no extra newline when a blank line already precedes the cursor", () => {
    const { nextValue } = insertMarkdownBlock("Hello\n\n", 7, 7, "TABLE");
    expect(nextValue).toBe("Hello\n\nTABLE");
  });

  it("adds a blank line after when inserting before existing text", () => {
    const { nextValue } = insertMarkdownBlock("World", 0, 0, "TABLE");
    expect(nextValue).toBe("TABLE\n\nWorld");
  });

  it("adds gaps on both sides when inserting in the middle of a paragraph", () => {
    const { nextValue } = insertMarkdownBlock("Before After", 6, 6, "TABLE");
    expect(nextValue).toBe("Before\n\nTABLE\n\n After");
  });

  it("replaces a selection rather than just inserting at a point", () => {
    // Selecting "World" in "Hello World" and inserting a table instead.
    const { nextValue } = insertMarkdownBlock("Hello World", 6, 11, "TABLE");
    expect(nextValue).toBe("Hello \n\nTABLE");
  });

  it("returns a cursor position that lands right after the inserted block", () => {
    const { nextValue, cursorPosition } = insertMarkdownBlock("Hi\n\n", 4, 4, "TABLE");
    expect(nextValue.slice(0, cursorPosition)).toBe("Hi\n\nTABLE");
  });
});
