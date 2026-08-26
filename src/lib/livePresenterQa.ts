export type PresenterQuestion = {
  id: string;
  question: string;
  status: "queued" | "answering_now" | "answered";
  upvotes_count: number;
  created_at: string;
};

export function selectPresenterQuestions(
  questions: PresenterQuestion[],
  limit = 3,
): PresenterQuestion[] {
  return questions
    .filter((question) => question.status !== "answered")
    .slice()
    .sort(
      (a, b) =>
        b.upvotes_count - a.upvotes_count ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    .slice(0, Math.max(0, limit));
}
