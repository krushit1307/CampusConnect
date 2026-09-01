import { Flashcard } from '@/types/transcription';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

/**
 * SuperMemo SM-2 Spaced Repetition Algorithm.
 * Updates flashcard repetition intervals and ease factor based on learner feedback.
 */
export function calculateNextReview(
  card: Flashcard,
  rating: ReviewRating
): Flashcard {
  const gradeMap: Record<ReviewRating, number> = {
    again: 1,
    hard: 2,
    good: 3,
    easy: 5,
  };

  const grade = gradeMap[rating];
  let { repetitions, intervalDays, easeFactor } = card;

  if (grade < 3) {
    // Failed recall: reset repetitions
    repetitions = 0;
    intervalDays = 1;
  } else {
    // Successful recall
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitions += 1;
  }

  // Update Ease Factor (EF)
  easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (easeFactor < 1.3) {
    easeFactor = 1.3; // SM-2 minimum threshold
  }

  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + intervalDays);

  return {
    ...card,
    repetitions,
    intervalDays,
    easeFactor,
    dueDate: nextDue.toISOString(),
  };
}
