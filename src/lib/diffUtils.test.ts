import { describe, it, expect } from "vitest";
import { computeWordDiff, computeLineDiff } from "./diffUtils";

describe("diffUtils", () => {
  describe("computeWordDiff", () => {
    it("handles identical texts", () => {
      const text = "Hello world meeting notes.";
      const result = computeWordDiff(text, text);

      expect(result.changes.length).toBe(1);
      expect(result.changes[0]).toEqual({
        value: text,
        type: "unchanged",
      });
      expect(result.stats.addedCount).toBe(0);
      expect(result.stats.removedCount).toBe(0);
    });

    it("detects additions", () => {
      const oldText = "Hello world";
      const newText = "Hello amazing world";
      const result = computeWordDiff(oldText, newText);

      const added = result.changes.filter((c) => c.type === "added");
      expect(added.length).toBeGreaterThan(0);
      expect(added.map((c) => c.value).join("")).toContain("amazing");
    });

    it("detects removals", () => {
      const oldText = "Meeting notes for engineering team";
      const newText = "Meeting notes";
      const result = computeWordDiff(oldText, newText);

      const removed = result.changes.filter((c) => c.type === "removed");
      expect(removed.length).toBeGreaterThan(0);
      expect(removed.map((c) => c.value).join("")).toContain("engineering team");
    });

    it("handles empty strings", () => {
      const result = computeWordDiff("", "");
      expect(result.changes).toEqual([]);
      expect(result.stats.addedCount).toBe(0);
      expect(result.stats.removedCount).toBe(0);
    });

    it("handles full replacement", () => {
      const result = computeWordDiff("Old text", "New content");
      expect(result.stats.addedCount).toBeGreaterThan(0);
      expect(result.stats.removedCount).toBeGreaterThan(0);
    });
  });

  describe("computeLineDiff", () => {
    it("detects line additions and removals", () => {
      const oldText = "Line 1\nLine 2\nLine 3";
      const newText = "Line 1\nLine 2 updated\nLine 3\nLine 4";

      const result = computeLineDiff(oldText, newText);
      expect(result.changes.some((c) => c.type === "added" && c.value.includes("Line 4"))).toBe(
        true,
      );
      expect(result.changes.some((c) => c.type === "removed" && c.value === "Line 2")).toBe(true);
    });
  });
});
