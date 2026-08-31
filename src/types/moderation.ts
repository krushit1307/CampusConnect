/**
 * Moderation and Apology Types for CampusConnect
 * Defines interfaces for behavioral contrition and LLM evaluation workflows.
 */

export interface ApologySubmission {
    userId: string;
    violationId: string;
    text: string;
}

export interface LLMEvaluationResult {
    isSincere: boolean;
    score: number; // 0.0 to 1.0
    rawResponse: string;
    feedback?: string;
}

export interface ApologyRecord {
    id: string;
    user_id: string;
    violation_id: string;
    apology_text: string;
    llm_evaluation_score: number | null;
    llm_is_sincere: boolean | null;
    llm_raw_response: string | null;
    status: 'pending' | 'approved' | 'rejected';
    submitted_at: string;
    reviewed_at: string | null;
    user_email: string;
    user_name: string;
}
