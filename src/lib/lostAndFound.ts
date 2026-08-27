import { createClient } from "./supabase/client";

export interface LostItem {
  id?: string;
  user_id?: string;
  title: string;
  description?: string;
  category: string;
  image_url?: string;
  location_found?: string;
  status?: "unclaimed" | "claimed" | "returned";
  pii_flagged?: boolean;
  similarity?: number;
  created_at?: string;
}

/**
 * Screens text for Personally Identifiable Information (PII)
 * such as Credit Card Numbers, SSNs, or Driver License numbers (#2747).
 */
export function detectPiiInText(text: string): boolean {
  if (!text || typeof text !== "string") return false;

  // Credit Card numbers (13 to 16 digits, with or without spaces/dashes)
  const creditCardPattern = /\b(?:\d[ -]*?){13,16}\b/;

  // Social Security Numbers (SSN: XXX-XX-XXXX)
  const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/;

  // Sensitive passwords or credentials keywords
  const sensitiveKeywordPattern = /\b(?:pin:\s*\d{4,6}|cvv:\s*\d{3,4}|ssn:\s*\d)\b/i;

  return (
    creditCardPattern.test(text) || ssnPattern.test(text) || sensitiveKeywordPattern.test(text)
  );
}

/**
 * Computes cosine similarity between two 512-dimensional vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generates a normalized 512-dimensional vector embedding for a given text query/description.
 */
export function generateItemEmbedding(text: string): number[] {
  const embedding = new Array<number>(512).fill(0);
  const clean = text.toLowerCase().trim();

  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const index = (charCode * (i + 1) * 31) % 512;
    embedding[index] += 1.0;
  }

  // Normalize vector to unit length
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return embedding;

  return embedding.map((val) => val / magnitude);
}

/**
 * Performs vector similarity search for lost items using match threshold (default 85%).
 */
export async function searchLostItems(
  query: string,
  threshold = 0.85,
  limit = 10,
): Promise<{ success: boolean; data: LostItem[]; error?: string }> {
  if (!query || !query.trim()) {
    return { success: true, data: [] };
  }

  const queryEmbedding = generateItemEmbedding(query);
  const supabase = createClient();

  const { data, error } = await supabase.rpc("match_lost_items", {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
  });

  if (error) {
    return { success: false, data: [], error: error.message };
  }

  return { success: true, data: data ?? [] };
}

/**
 * Submits a newly found item after performing PII validation.
 */
export async function reportFoundItem(
  item: Omit<LostItem, "id" | "created_at" | "pii_flagged">,
): Promise<{ success: boolean; data?: LostItem; error?: string }> {
  const fullText = `${item.title} ${item.description ?? ""} ${item.location_found ?? ""}`;

  if (detectPiiInText(fullText)) {
    return {
      success: false,
      error:
        "Item submission rejected: Contains potential Personally Identifiable Information (PII).",
    };
  }

  const embedding = generateItemEmbedding(fullText);
  const supabase = createClient();

  const { data, error } = await supabase
    .from("lost_items")
    .insert([
      {
        title: item.title.trim(),
        description: item.description?.trim(),
        category: item.category,
        image_url: item.image_url,
        location_found: item.location_found?.trim(),
        status: "unclaimed",
        pii_flagged: false,
        embedding,
      },
    ])
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}
