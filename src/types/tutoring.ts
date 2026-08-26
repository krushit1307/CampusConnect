/**
 * Tutoring Types for CampusConnect
 * Defines interfaces for P2P tutoring credits and rescue workflows.
 */

export interface TutoringCredit {
    id: string;
    user_id: string;
    event_series_id: string;
    credits_granted: number;
    credits_used: number;
    reason: string;
    granted_at: string;
    expires_at: string;
}

export interface RescueEmailRequest {
    userId: string;
    eventSeriesId: string;
    seriesName: string;
}

export interface RescueEmailResponse {
    success: boolean;
    message: string;
    creditsGranted: number;
}
