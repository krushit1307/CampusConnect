export const CRITICAL_SAFETY_THREAT_MARKER = "CRITICAL_SAFETY_THREAT";

const SAFETY_LANGUAGE_PATTERN =
  /\b(?:unsafe|safety concern|violence|violent|harass(?:ed|ment|ing)|stalk(?:ed|ing|er)|following me|followed me|threat(?:ened|ening)?|assault(?:ed)?|attack(?:ed)?|physical harm|dangerous|weapon|abuse(?:d|ive)?|sexual misconduct)\b/i;

export type SafetyFeedback = {
  id: string;
  comments: string;
};

export function containsCriticalSafetyLanguage(text: string) {
  return SAFETY_LANGUAGE_PATTERN.test(text);
}

export function extractMarkedSafetyText(output: string) {
  const markerIndex = output.indexOf(CRITICAL_SAFETY_THREAT_MARKER);
  if (markerIndex !== 0) return null;
  return output.slice(CRITICAL_SAFETY_THREAT_MARKER.length).trim() || null;
}

export function findCriticalSafetyFeedbacks(output: string, feedbacks: SafetyFeedback[]) {
  const markedText = extractMarkedSafetyText(output);
  const matches = feedbacks.filter((feedback) => {
    if (containsCriticalSafetyLanguage(feedback.comments)) return true;
    if (!markedText) return false;
    return markedText.includes(feedback.comments) || feedback.comments.includes(markedText);
  });

  if (markedText && matches.length === 0) {
    return [{ id: "llm-unmatched", comments: markedText }];
  }
  return matches;
}
