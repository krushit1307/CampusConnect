export const CONSTITUTION_PLAGIARISM_THRESHOLD = 0.85;

const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "for",
  "from",
  "has",
  "have",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "this",
  "to",
  "we",
  "with",
]);

export interface ConstitutionPlagiarismCandidate {
  id: string;
  clubName?: string | null;
  rawText?: string | null;
}

export interface DuplicateParagraph {
  currentParagraph: string;
  sourceParagraph: string;
  similarity: number;
}

export interface ConstitutionPlagiarismMatch {
  sourceDocumentId: string;
  sourceClubName: string | null;
  similarity: number;
  duplicateParagraphs: DuplicateParagraph[];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeConstitutionText(text: string, clubNames: string[] = []) {
  let sanitized = text.normalize("NFKC").toLocaleLowerCase();
  for (const clubName of clubNames) {
    const normalizedName = clubName.normalize("NFKC").trim().toLocaleLowerCase();
    if (normalizedName.length >= 3) {
      sanitized = sanitized.replace(new RegExp(`\\b${escapeRegExp(normalizedName)}\\b`, "gu"), " ");
    }
  }

  return sanitized
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function vectorize(tokens: string[]) {
  const vector = new Map<string, number>();
  for (const token of tokens) vector.set(token, (vector.get(token) ?? 0) + 1);
  return vector;
}

export function cosineSimilarity(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return 0;
  const leftVector = vectorize(left);
  const rightVector = vectorize(right);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const count of leftVector.values()) leftMagnitude += count * count;
  for (const count of rightVector.values()) rightMagnitude += count * count;
  for (const [token, count] of leftVector) dot += count * (rightVector.get(token) ?? 0);

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return Math.min(1, dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude)));
}

function splitParagraphs(text: string) {
  return text
    .split(/\n\s*\n|\r\n\s*\r\n/u)
    .map((paragraph) => paragraph.replace(/\s+/gu, " ").trim())
    .filter((paragraph) => paragraph.length >= 40);
}

function paragraphSimilarity(left: string, right: string, clubNames: string[]) {
  return cosineSimilarity(
    sanitizeConstitutionText(left, clubNames),
    sanitizeConstitutionText(right, clubNames),
  );
}

export function findConstitutionPlagiarismMatches(
  currentText: string,
  candidates: ConstitutionPlagiarismCandidate[],
  currentClubName?: string | null,
): ConstitutionPlagiarismMatch[] {
  const currentTokens = sanitizeConstitutionText(currentText, [currentClubName ?? ""]);
  const currentParagraphs = splitParagraphs(currentText);
  const matches: ConstitutionPlagiarismMatch[] = [];

  for (const candidate of candidates) {
    if (!candidate.rawText?.trim()) continue;
    const candidateClubName = candidate.clubName ?? "";
    const similarity = cosineSimilarity(
      currentTokens,
      sanitizeConstitutionText(candidate.rawText, [currentClubName ?? "", candidateClubName]),
    );
    if (similarity < CONSTITUTION_PLAGIARISM_THRESHOLD) continue;

    const sourceParagraphs = splitParagraphs(candidate.rawText);
    const duplicateParagraphs: DuplicateParagraph[] = [];
    for (const currentParagraph of currentParagraphs) {
      let bestMatch: DuplicateParagraph | null = null;
      for (const sourceParagraph of sourceParagraphs) {
        const paragraphScore = paragraphSimilarity(currentParagraph, sourceParagraph, [
          currentClubName ?? "",
          candidateClubName,
        ]);
        if (
          paragraphScore >= CONSTITUTION_PLAGIARISM_THRESHOLD &&
          (!bestMatch || paragraphScore > bestMatch.similarity)
        ) {
          bestMatch = {
            currentParagraph,
            sourceParagraph,
            similarity: Number(paragraphScore.toFixed(4)),
          };
        }
      }
      if (bestMatch) duplicateParagraphs.push(bestMatch);
    }

    matches.push({
      sourceDocumentId: candidate.id,
      sourceClubName: candidateClubName || null,
      similarity: Number(similarity.toFixed(4)),
      duplicateParagraphs: duplicateParagraphs.slice(0, 20),
    });
  }

  return matches.sort((left, right) => right.similarity - left.similarity);
}
