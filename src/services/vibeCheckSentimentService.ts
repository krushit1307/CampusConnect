export type EmotionCategory = "Happy" | "Confused" | "Neutral" | "Engaged" | "Surprised" | "Bored";

export interface EmotionScore {
  emotion: EmotionCategory;
  score: number;
}

export interface AggregatedSentiment {
  happy: number;
  confused: number;
  neutral: number;
  engaged: number;
  surprised: number;
  bored: number;
  total: number;
  dominantEmotion: EmotionCategory;
  confusedPercentage: number;
  summaryText: string;
}

/**
 * Computes sentiment aggregation and percentage metrics.
 */
export function aggregateSentiments(emotions: EmotionCategory[]): AggregatedSentiment {
  const counts: Record<EmotionCategory, number> = {
    Happy: 0,
    Confused: 0,
    Neutral: 0,
    Engaged: 0,
    Surprised: 0,
    Bored: 0,
  };

  for (const emotion of emotions) {
    if (counts[emotion] !== undefined) {
      counts[emotion]++;
    } else {
      counts.Neutral++;
    }
  }

  const total = emotions.length;
  if (total === 0) {
    return {
      happy: 0,
      confused: 0,
      neutral: 0,
      engaged: 0,
      surprised: 0,
      bored: 0,
      total: 0,
      dominantEmotion: "Neutral",
      confusedPercentage: 0,
      summaryText: "Waiting for attendee vibe check signals...",
    };
  }

  let dominant: EmotionCategory = "Neutral";
  let maxCount = -1;

  for (const [emotion, count] of Object.entries(counts) as [EmotionCategory, number][]) {
    if (count > maxCount) {
      maxCount = count;
      dominant = emotion;
    }
  }

  const confusedPercentage = Math.round((counts.Confused / total) * 100);
  let summaryText = `${dominant} is the dominant audience emotion (${Math.round((maxCount / total) * 100)}%).`;
  if (confusedPercentage >= 30) {
    summaryText = `${confusedPercentage}% of your audience looks confused. Consider pausing for questions.`;
  }

  return {
    happy: counts.Happy,
    confused: counts.Confused,
    neutral: counts.Neutral,
    engaged: counts.Engaged,
    surprised: counts.Surprised,
    bored: counts.Bored,
    total,
    dominantEmotion: dominant,
    confusedPercentage,
    summaryText,
  };
}

/**
 * Heuristic classifier for detected face landmark measurements or expression values
 */
export function classifyExpression(features: {
  smileConfidence?: number;
  eyebrowFrownConfidence?: number;
  eyeWideConfidence?: number;
  neutralConfidence?: number;
}): EmotionCategory {
  const smile = features.smileConfidence || 0;
  const frown = features.eyebrowFrownConfidence || 0;
  const eyesWide = features.eyeWideConfidence || 0;

  if (frown > 0.6) return "Confused";
  if (smile > 0.6) return "Happy";
  if (eyesWide > 0.6) return "Surprised";
  if (smile > 0.3) return "Engaged";
  return "Neutral";
}
