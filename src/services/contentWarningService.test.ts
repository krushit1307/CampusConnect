// ============================================================
// CampusConnect – Content Warning Service Tests
// src/services/contentWarningService.test.ts
// Issue #3679
// ============================================================

import { describe, it, expect } from "vitest";
import {
  analyzeContentWarning,
  formatWarningCategories,
  getWarningDescription,
  type WarningCategory,
} from "./contentWarningService";

describe("contentWarningService", () => {
  describe("analyzeContentWarning", () => {
    it("returns no warning for clean content", () => {
      const result = analyzeContentWarning(
        "Annual Club Fair",
        "Join us for our annual club fair showcasing all student organizations.",
      );
      expect(result.hasWarning).toBe(false);
      expect(result.categories).toEqual([]);
      expect(result.matchedTerms).toEqual([]);
    });

    it("detects violence-related terms in title", () => {
      const result = analyzeContentWarning(
        "The Impacts of Trauma",
        "A lecture on psychological trauma recovery.",
      );
      expect(result.hasWarning).toBe(true);
      expect(result.categories).toContain("Violence");
      expect(result.categories).toContain("Mental Health");
      expect(result.matchedTerms).toContain("trauma");
    });

    it("detects mental health terms in description", () => {
      const result = analyzeContentWarning(
        "Wellness Workshop",
        "A workshop on managing anxiety and depression in college students.",
      );
      expect(result.hasWarning).toBe(true);
      expect(result.categories).toContain("Mental Health");
      expect(result.matchedTerms).toContain("anxiety");
      expect(result.matchedTerms).toContain("depression");
    });

    it("detects substance abuse terms", () => {
      const result = analyzeContentWarning(
        "Health Awareness Day",
        "Information session on substance abuse and addiction recovery resources.",
      );
      expect(result.hasWarning).toBe(true);
      expect(result.categories).toContain("Substance Abuse");
      expect(result.matchedTerms).toContain("substance abuse");
      expect(result.matchedTerms).toContain("addiction recovery");
    });

    it("detects self-harm terms", () => {
      const result = analyzeContentWarning(
        "Support Group Meeting",
        "A safe space for those dealing with self-harm and suicidal thoughts.",
      );
      expect(result.hasWarning).toBe(true);
      expect(result.categories).toContain("Self-Harm");
      expect(result.categories).toContain("Mental Health");
    });

    it("detects eating disorder terms", () => {
      const result = analyzeContentWarning(
        "Body Positivity Talk",
        "Discussion on anorexia, bulimia, and body image recovery.",
      );
      expect(result.hasWarning).toBe(true);
      expect(result.categories).toContain("Eating Disorders");
      expect(result.categories).toContain("Mental Health");
    });

    it("detects discrimination terms", () => {
      const result = analyzeContentWarning(
        "Social Justice Panel",
        "Panel discussion on systemic racism and discrimination in education.",
      );
      expect(result.hasWarning).toBe(true);
      expect(result.categories).toContain("Discrimination");
    });

    it("detects sexual content terms", () => {
      const result = analyzeContentWarning(
        "Health Education",
        "Workshop on sexual health and consent.",
      );
      expect(result.hasWarning).toBe(true);
      expect(result.categories).toContain("Sexual Content");
    });

    it("is case-insensitive", () => {
      const result = analyzeContentWarning(
        "TRAUMA Recovery Workshop",
        "Understanding TRAUMA and its effects.",
      );
      expect(result.hasWarning).toBe(true);
      expect(result.matchedTerms).toContain("trauma");
    });

    it("handles empty strings", () => {
      const result = analyzeContentWarning("", "");
      expect(result.hasWarning).toBe(false);
      expect(result.categories).toEqual([]);
    });

    it("deduplicates matched terms", () => {
      const result = analyzeContentWarning(
        "Trauma and Trauma Recovery",
        "Understanding trauma, trauma healing, and trauma-informed care.",
      );
      const traumaCount = result.matchedTerms.filter(
        (t) => t === "trauma",
      ).length;
      expect(traumaCount).toBe(1);
    });

    it("does not match partial words (word boundary)", () => {
      const result = analyzeContentWarning(
        "Catalog Sale",
        "Scissor sharpening workshop.",
      );
      expect(result.matchedTerms).not.toContain("war");
    });

    it("returns multiple categories for multi-topic content", () => {
      const result = analyzeContentWarning(
        "Recovery Panel",
        "Discussion on substance abuse, mental health, and trauma recovery.",
      );
      expect(result.hasWarning).toBe(true);
      expect(result.categories.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("formatWarningCategories", () => {
    it("formats single category", () => {
      expect(formatWarningCategories(["Violence"])).toBe("Violence");
    });

    it("formats multiple categories with commas", () => {
      const result = formatWarningCategories([
        "Violence",
        "Mental Health",
        "Substance Abuse",
      ]);
      expect(result).toBe("Violence, Mental Health, Substance Abuse");
    });

    it("handles empty array", () => {
      expect(formatWarningCategories([])).toBe("");
    });
  });

  describe("getWarningDescription", () => {
    it("returns description for violence", () => {
      const desc = getWarningDescription(["Violence"]);
      expect(desc).toContain("violence");
      expect(desc).toContain("trauma");
    });

    it("returns description for mental health", () => {
      const desc = getWarningDescription(["Mental Health"]);
      expect(desc).toContain("mental health");
    });

    it("combines descriptions for multiple categories", () => {
      const desc = getWarningDescription(["Violence", "Mental Health"]);
      expect(desc).toContain("violence");
      expect(desc).toContain("mental health");
    });

    it("handles all categories", () => {
      const allCategories: WarningCategory[] = [
        "Violence", "Mental Health", "Substance Abuse",
        "Sexual Content", "Eating Disorders", "Self-Harm",
        "Discrimination",
      ];
      const desc = getWarningDescription(allCategories);
      expect(desc.length).toBeGreaterThan(50);
    });
  });
});
