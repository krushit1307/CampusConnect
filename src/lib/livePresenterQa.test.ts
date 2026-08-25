import { describe, expect, it } from "vitest";

import { selectPresenterQuestions, type PresenterQuestion } from "./livePresenterQa";

const question = (
  id: string,
  votes: number,
  status: PresenterQuestion["status"] = "queued",
): PresenterQuestion => ({
  id,
  question: `Question ${id}`,
  status,
  upvotes_count: votes,
  created_at: `2026-08-25T12:0${id}Z`,
});

describe("selectPresenterQuestions", () => {
  it("returns the three highest-voted unanswered questions", () => {
    expect(
      selectPresenterQuestions([
        question("1", 2),
        question("2", 9),
        question("3", 5),
        question("4", 7),
      ]).map((item) => item.id),
    ).toEqual(["2", "4", "3"]);
  });

  it("removes answered questions before ranking", () => {
    expect(
      selectPresenterQuestions([question("1", 100, "answered"), question("2", 4)]).map(
        (item) => item.id,
      ),
    ).toEqual(["2"]);
  });

  it("uses oldest submission order to break equal-vote ties and respects a custom limit", () => {
    expect(
      selectPresenterQuestions([question("3", 5), question("1", 5), question("2", 5)], 2).map(
        (item) => item.id,
      ),
    ).toEqual(["1", "2"]);
    expect(selectPresenterQuestions([question("1", 5)], 0)).toEqual([]);
  });
});
