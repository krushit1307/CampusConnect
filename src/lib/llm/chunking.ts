// =============================================================================
// Utility: Text Chunking for LLM Context Limits
// Issue: #3539 - Implement 'Real-Time Event Transcript Summarizer (TL;DR)'
// Description: Client-side utility to split massive VTT transcripts into 
// manageable chunks based on estimated token counts. Used if the frontend 
// needs to stream chunks to the Edge Function to avoid HTTP timeout limits.
// =============================================================================

export interface TextChunk {
    index: number;
    text: string;
    wordCount: number;
    estimatedTokens: number;
}

/**
 * Estimates the token count for a given string.
 * Standard heuristic: 1 token ≈ 4 characters or 0.75 words.
 * We use a conservative 1 word = 1.3 tokens to prevent context overflow.
 */
export function estimateTokens(text: string): number {
    const words = text.trim().split(/\s+/).length;
    return Math.ceil(words * 1.3);
}

/**
 * Splits a large transcript into chunks that fit within a specified token limit.
 * Attempts to break at sentence boundaries (periods, newlines) to maintain context.
 * 
 * @param text - The full raw transcript text
 * @param maxTokensPerChunk - The maximum tokens allowed per chunk (default 3000)
 * @returns Array of TextChunk objects
 */
export function chunkTranscript(text: string, maxTokensPerChunk: number = 3000): TextChunk[] {
    if (!text || text.trim().length === 0) return [];

    const sentences = text.split(/(?<=[.!?])\s+/); // Split by sentence endings
    const chunks: TextChunk[] = [];

    let currentChunkText = "";
    let currentChunkWords = 0;
    let chunkIndex = 0;

    for (const sentence of sentences) {
        const sentenceWords = sentence.trim().split(/\s+/).length;
        const sentenceTokens = Math.ceil(sentenceWords * 1.3);

        // If adding this sentence exceeds the limit, push the current chunk and start a new one
        if (currentChunkWords > 0 && (currentChunkWords + sentenceWords) * 1.3 > maxTokensPerChunk) {
            chunks.push({
                index: chunkIndex++,
                text: currentChunkText.trim(),
                wordCount: currentChunkWords,
                estimatedTokens: Math.ceil(currentChunkWords * 1.3)
            });
            currentChunkText = "";
            currentChunkWords = 0;
        }

        currentChunkText += sentence + " ";
        currentChunkWords += sentenceWords;
    }

    // Push the final remaining chunk
    if (currentChunkText.trim().length > 0) {
        chunks.push({
            index: chunkIndex,
            text: currentChunkText.trim(),
            wordCount: currentChunkWords,
            estimatedTokens: Math.ceil(currentChunkWords * 1.3)
        });
    }

    return chunks;
}

/**
 * Calculates the total estimated tokens for an array of chunks.
 */
export function getTotalTokens(chunks: TextChunk[]): number {
    return chunks.reduce((sum, chunk) => sum + chunk.estimatedTokens, 0);
}
