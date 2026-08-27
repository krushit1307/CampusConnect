export interface SemanticSearchResult {
  id: string;
  name: string;
  description: string;
  tags: string[];
  similarity: number;
}

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
}

/**
 * Normalizes input queries by stripping special characters and lowercasing
 * to improve embedding quality before passing to the model.
 */
export function normalizeSearchQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Combines a club's title, description, and tags into a single rich text block
 * optimized for vector embedding generation.
 */
export function buildClubEmbeddingText(name: string, description: string, tags: string[]): string {
  const normalizedTags = tags.map((t) => t.replace(/^#/, "").trim()).join(", ");
  return `Club: ${name}. Description: ${description}. Tags: ${normalizedTags}.`.trim();
}

/**
 * Filters and formats raw Postgres semantic search results, ensuring they meet the required similarity threshold.
 */
export function processSemanticSearchResults(
  rawResults: SemanticSearchResult[],
  minSimilarity: number = 0.3,
): SemanticSearchResult[] {
  return rawResults
    .filter((result) => result.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity);
}
