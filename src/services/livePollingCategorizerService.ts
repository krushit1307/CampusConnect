// =============================================================================
// File: src/services/livePollingCategorizerService.ts
// Task: Real-Time Live Polling — NLP Free-Text Response Categorization Engine
// Description: Core NLP service layer that ingests raw free-text poll answers,
//              tokenizes & strips stopwords, extracts key N-gram phrases, and
//              clusters hundreds of responses on the fly into thematic topic
//              groups with real-time percentage headcounts and sample quotes.
// =============================================================================

import { analyzeSentiment } from "@/lib/nlp/sentimentAnalyzer";

export interface RawPollResponse {
  id: string;
  text: string;
  createdAt?: string;
  upvotes?: number;
}

export interface CategorizedPollCluster {
  id: string;
  title: string;
  keywords: string[];
  responseCount: number;
  percentage: number;
  upvoteCount: number;
  sentimentTone: "POSITIVE" | "NEUTRAL" | "CRITICAL";
  sampleQuotes: string[];
  responses: RawPollResponse[];
}

export interface LivePollAnalysisResult {
  pollId: string;
  questionTitle: string;
  totalResponses: number;
  clusters: CategorizedPollCluster[];
  analyzedAt: string;
}

/** Common English stopwords to filter out before phrase clustering */
const COMMON_STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
  "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
  "but", "by", "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
  "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had",
  "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
  "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd",
  "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's",
  "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once",
  "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
  "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
  "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
  "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through",
  "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're",
  "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
  "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you",
  "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves", "like", "really",
  "think", "just", "get", "make", "need"
]);

/**
 * Cleanses text and splits it into normalized tokens (strips URLs, punctuation, and stopwords).
 */
export function tokenizeAndClean(text: string): string[] {
  if (!text) return [];
  const normalized = text
    .toLowerCase()
    .replace(/(https?:\/\/[^\s]+)/g, "")
    .replace(/[^\w\s]/g, " ")
    .trim();

  return normalized
    .split(/\s+/)
    .filter((token) => token.length > 1 && !COMMON_STOPWORDS.has(token));
}

/**
 * Extracts N-gram key phrases (unigrams and bigrams) from tokens.
 */
export function extractNGrams(tokens: string[]): string[] {
  const phrases: string[] = [];
  tokens.forEach((t) => phrases.push(t));

  for (let i = 0; i < tokens.length - 1; i++) {
    phrases.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return phrases;
}

/**
 * Computes Jaccard similarity score between token sets (0.0 to 1.0).
 */
export function calculateSimilarityScore(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersectionCount = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersectionCount++;
  });

  const unionCount = new Set([...setA, ...setB]).size;
  return unionCount > 0 ? intersectionCount / unionCount : 0;
}

/**
 * Determines sentiment tone from an array of responses.
 */
export function determineClusterSentiment(responses: RawPollResponse[]): "POSITIVE" | "NEUTRAL" | "CRITICAL" {
  if (responses.length === 0) return "NEUTRAL";
  let totalNormalized = 0;
  responses.forEach((r) => {
    const res = analyzeSentiment(r.text);
    totalNormalized += res.normalized;
  });
  const avg = totalNormalized / responses.length;
  if (avg >= 1.5) return "POSITIVE";
  if (avg <= -1.0) return "CRITICAL";
  return "NEUTRAL";
}

/**
 * Generates a human-readable cluster title from token frequencies.
 */
export function generateClusterTitle(keywords: string[]): string {
  if (!keywords || keywords.length === 0) return "General Feedback";
  const topWords = keywords.slice(0, 2).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return topWords.join(" & ") + " Concerns";
}

/**
 * Categorizes a batch of free-text poll responses into distinct topic clusters.
 */
export function categorizeFreeTextResponses(
  responses: RawPollResponse[],
  questionTitle: string = "Live Poll",
  pollId: string = "poll-1"
): LivePollAnalysisResult {
  if (!responses || responses.length === 0) {
    return {
      pollId,
      questionTitle,
      totalResponses: 0,
      clusters: [],
      analyzedAt: new Date().toISOString(),
    };
  }

  // 1. Tokenize all responses
  const tokenizedMap = new Map<string, string[]>();
  responses.forEach((r) => {
    tokenizedMap.set(r.id, tokenizeAndClean(r.text));
  });

  // 2. Greedy clustering based on token overlap similarity (threshold >= 0.25)
  const clustersData: Array<{
    centroidTokens: string[];
    responses: RawPollResponse[];
  }> = [];

  responses.forEach((response) => {
    const tokens = tokenizedMap.get(response.id) || [];
    let bestMatchClusterIdx = -1;
    let bestSimilarity = 0.20; // minimum similarity threshold to join existing cluster

    clustersData.forEach((cluster, idx) => {
      const sim = calculateSimilarityScore(tokens, cluster.centroidTokens);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestMatchClusterIdx = idx;
      }
    });

    if (bestMatchClusterIdx >= 0) {
      clustersData[bestMatchClusterIdx].responses.push(response);
      // Update centroid tokens
      clustersData[bestMatchClusterIdx].centroidTokens = Array.from(
        new Set([...clustersData[bestMatchClusterIdx].centroidTokens, ...tokens])
      );
    } else {
      // Create new cluster
      clustersData.push({
        centroidTokens: tokens,
        responses: [response],
      });
    }
  });

  const totalResponses = responses.length;

  // 3. Format clusters payload
  const formattedClusters: CategorizedPollCluster[] = clustersData.map((c, idx) => {
    // Rank keyword frequencies in this cluster
    const wordFreq: Record<string, number> = {};
    c.responses.forEach((r) => {
      const tokens = tokenizedMap.get(r.id) || [];
      tokens.forEach((t) => {
        wordFreq[t] = (wordFreq[t] || 0) + 1;
      });
    });

    const topKeywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, 5);

    const title = generateClusterTitle(topKeywords);
    const percentage = Math.round((c.responses.length / totalResponses) * 1000) / 10;
    const upvoteCount = c.responses.reduce((sum, r) => sum + (r.upvotes || 0), 0);
    const sentimentTone = determineClusterSentiment(c.responses);

    // Pick top 3 sample quotes (longer responses preferred for context)
    const sampleQuotes = [...c.responses]
      .sort((a, b) => b.text.length - a.text.length)
      .slice(0, 3)
      .map((r) => r.text);

    return {
      id: `cluster-${idx + 1}`,
      title,
      keywords: topKeywords,
      responseCount: c.responses.length,
      percentage,
      upvoteCount,
      sentimentTone,
      sampleQuotes,
      responses: c.responses,
    };
  });

  // Sort clusters by response count (highest first)
  formattedClusters.sort((a, b) => b.responseCount - a.responseCount);

  return {
    pollId,
    questionTitle,
    totalResponses,
    clusters: formattedClusters,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Incrementally adds a new free-text response to existing live poll analysis results on the fly.
 */
export function addResponseToClusters(
  newResponse: RawPollResponse,
  currentAnalysis: LivePollAnalysisResult
): LivePollAnalysisResult {
  const allResponses = [
    ...currentAnalysis.clusters.flatMap((c) => c.responses),
    newResponse,
  ];

  return categorizeFreeTextResponses(
    allResponses,
    currentAnalysis.questionTitle,
    currentAnalysis.pollId
  );
}
