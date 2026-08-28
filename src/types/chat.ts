/**
 * Chat and Rate Limiting Types for CampusConnect
 * Defines interfaces for chat messages and rate limit responses.
 */

export interface ChatMessage {
    id: string;
    user_id: string;
    channel_id: string;
    content: string;
    created_at: string;
    isSystemMessage?: boolean;
}

export interface RateLimitResponse {
    success: false;
    rateLimited: true;
    retryAfterSeconds: number;
    systemMessage: string;
}

export interface ChatSendResponse {
    success: boolean;
    message?: ChatMessage;
    remainingTokens?: number;
    rateLimited?: boolean;
    retryAfterSeconds?: number;
    systemMessage?: string;
}
