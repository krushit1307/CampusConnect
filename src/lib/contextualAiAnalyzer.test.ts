import { describe, it, expect, vi } from "vitest";
import {
  requiresContextualAnalysis,
  parseContextualAnalysis,
  isViolenceFlag,
} from "./contextual-ai-analyzer";

describe("Contextual AI Analyzer - Issue #4419", () => {
  describe("requiresContextualAnalysis", () => {
    it("detects common violence-related slang words", () => {
      expect(requiresContextualAnalysis("This exam killed me")).toBe(true);
      expect(requiresContextualAnalysis("I'm dead 💀")).toBe(true);
      expect(requiresContextualAnalysis("The gym destroyed me today")).toBe(true);
      expect(requiresContextualAnalysis("That concert was murder")).toBe(true);
      expect(requiresContextualAnalysis("Let's destroy them in the game")).toBe(true);
      expect(requiresContextualAnalysis("The test was a massacre")).toBe(true);
    });

    it("returns false for non-violence text", () => {
      expect(requiresContextualAnalysis("Hello everyone!")).toBe(false);
      expect(requiresContextualAnalysis("Great presentation today")).toBe(false);
      expect(requiresContextualAnalysis("What time is the meeting?")).toBe(false);
      expect(requiresContextualAnalysis("I love this campus")).toBe(false);
    });

    it("handles empty and null input", () => {
      expect(requiresContextualAnalysis("")).toBe(false);
      expect(requiresContextualAnalysis(null as any)).toBe(false);
      expect(requiresContextualAnalysis(undefined as any)).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(requiresContextualAnalysis("KILLED")).toBe(true);
      expect(requiresContextualAnalysis("Dead")).toBe(true);
      expect(requiresContextualAnalysis("DESTROYED")).toBe(true);
      expect(requiresContextualAnalysis("MURDER")).toBe(true);
    });

    it("detects actual threats containing violence keywords", () => {
      expect(requiresContextualAnalysis("I'm going to kill you tonight")).toBe(true);
      expect(requiresContextualAnalysis("You're dead, I know where you live")).toBe(true);
      expect(requiresContextualAnalysis("I'll shoot you on sight")).toBe(true);
      expect(requiresContextualAnalysis("I'm going to bomb the building")).toBe(true);
    });
  });
});
