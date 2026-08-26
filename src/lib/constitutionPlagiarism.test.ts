import { describe, expect, it } from "vitest";
import {
  CONSTITUTION_PLAGIARISM_THRESHOLD,
  cosineSimilarity,
  findConstitutionPlagiarismMatches,
  sanitizeConstitutionText,
} from "../../supabase/functions/_shared/constitution-plagiarism";

describe("constitution plagiarism detection", () => {
  it("removes club names and stop words before scoring", () => {
    expect(sanitizeConstitutionText("The Acme Club shall meet monthly", ["Acme Club"])).toEqual([
      "shall",
      "meet",
      "monthly",
    ]);
  });

  it("returns one for equivalent token vectors", () => {
    expect(cosineSimilarity(["members", "vote", "annually"], ["annually", "vote", "members"])).toBe(
      1,
    );
    expect(cosineSimilarity([], ["members"])).toBe(0);
  });

  it("flags high-similarity constitutions and highlights duplicate paragraphs", () => {
    const paragraph =
      "Members shall elect the executive committee annually by majority vote of the active membership. " +
      "The secretary shall publish the election results to all members.";
    const current = paragraph;
    const source = paragraph;

    const matches = findConstitutionPlagiarismMatches(
      current,
      [{ id: "source-1", clubName: "Other Club", rawText: source }],
      "Current Club",
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.similarity).toBeGreaterThanOrEqual(CONSTITUTION_PLAGIARISM_THRESHOLD);
    expect(matches[0]?.duplicateParagraphs[0]?.currentParagraph).toBe(paragraph);
    expect(matches[0]?.duplicateParagraphs[0]?.sourceParagraph).toBe(paragraph);
  });

  it("does not flag unrelated constitutions", () => {
    const matches = findConstitutionPlagiarismMatches(
      "Members organize community volunteering and workshops throughout the semester.",
      [
        {
          id: "source-1",
          rawText: "The finance committee manages budgets and reimbursement records.",
        },
      ],
    );
    expect(matches).toEqual([]);
  });
});
