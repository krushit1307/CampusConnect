export const claimIntentRegexes = [
  /\bassign\s+me\b/i,
  /\bplease\s+assign\b/i,
  /\binterested\b/i,
  /\bi(?:\s+would|'d)\s+like\s+to\s+contribute\b/i,
  /\bcan\s+i\s+work\s+on\s+this\b/i,
  /\bcan\s+i\s+take\s+this\s+issue\b/i,
  /\bhappy\s+to\s+work\s+on\s+this\b/i,
  /\bi\s+want\s+to\s+work\s+on\s+this\b/i,
  /\bi\s+want\s+this\s+issue\b/i,
];

export const activitySignalRegexes = [
  /\bworking\s+on\s+it\b/i,
  /\bin\s+progress\b/i,
  /\bopened\s+(a\s+)?pr\b/i,
  /\bsubmitted\s+(a\s+)?pr\b/i,
  /\bwill\s+push\s+soon\b/i,
  /\bready\s+for\s+review\b/i,
];

export function isNaturalLanguageClaim(text) {
  const value = String(text || "");
  return claimIntentRegexes.some((rx) => rx.test(value));
}

export function isActivitySignal(text) {
  const value = String(text || "");
  return activitySignalRegexes.some((rx) => rx.test(value));
}
