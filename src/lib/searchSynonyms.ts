/**
 * Client-side synonym dictionary mapping for campus abbreviations & terms.
 * Used for client-side search filtering fallbacks and query normalization.
 */

export const DEFAULT_CAMPUS_SYNONYMS: Record<string, string> = {
  cs: "computer science",
  "comp sci": "computer science",
  swe: "software engineering",
  eecs: "electrical engineering",
  bba: "business administration",
  mba: "business administration",
  psych: "psychology",
  bio: "biology",
  chem: "chemistry",
  phys: "physics",
  calc: "calculus",
  stats: "statistics",
  eng: "engineering",
  lit: "literature",
  "poli sci": "political science",
  econ: "economics",
};

/**
 * Expands abbreviations and synonyms in a search query.
 * For example: "CS Club" -> "computer science Club"
 */
export function expandCampusSynonyms(
  query: string,
  synonymMap: Record<string, string> = DEFAULT_CAMPUS_SYNONYMS,
): string {
  if (!query || !query.trim()) {
    return query;
  }

  let result = query.trim();

  // Sort keys by length descending to match multi-word phrases before single-word abbreviations
  const keys = Object.keys(synonymMap).sort((a, b) => b.length - a.length);

  for (const term of keys) {
    const replacement = synonymMap[term];
    // Match whole words using word boundary regex (\b)
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escapedTerm}\\b`, "gi");
    result = result.replace(regex, replacement);
  }

  return result;
}
