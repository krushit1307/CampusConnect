import { describe, it, expect } from "vitest";
import { analyzeQaProfanity } from "./qaProfanityFilter";

describe("Live Speaker Q&A Profanity Filter - Senior Engine (#3192)", () => {
  describe("Sub-50ms Local Profanity Analysis", () => {
    it("flags profane and toxic terms and generates shadowban status", () => {
      const result = analyzeQaProfanity("What a stupid question, this is a total scam!");

      expect(result.isProfane).toBe(true);
      expect(result.isShadowbanned).toBe(true);
      expect(result.matchedTerms).toContain("stupid");
      expect(result.matchedTerms).toContain("scam");
      expect(result.cleanedContent).toContain("******");
    });

    it("prevents the Scunthorpe problem (legitimate words containing substrings pass cleanly)", () => {
      // "classic" contains "ass", "assessment" contains "ass", "pass" contains "ass"
      const cleanInput = "The professor gave a classic lecture and a fair assessment pass.";
      const result = analyzeQaProfanity(cleanInput);

      expect(result.isProfane).toBe(false);
      expect(result.isShadowbanned).toBe(false);
      expect(result.matchedTerms.length).toBe(0);
      expect(result.cleanedContent).toBe(cleanInput);
    });

    it("respects event-specific custom whitelist term overrides", () => {
      const input = "This discussion is about spam prevention techniques.";
      // Whitelist "spam" for a computer science security seminar
      const result = analyzeQaProfanity(input, ["spam"]);

      expect(result.isProfane).toBe(false);
      expect(result.isShadowbanned).toBe(false);
      expect(result.matchedTerms).not.toContain("spam");
    });

    it("executes profanity analysis in under 50ms", () => {
      const longInput =
        "Is there any opportunity to discuss classical literature, assessment strategies, and student pass rates in the upcoming seminar?";
      const result = analyzeQaProfanity(longInput);

      expect(result.latencyMs).toBeLessThan(50);
    });
  });
});
