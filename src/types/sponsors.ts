/**
 * Sponsor and CPC Types for CampusConnect
 * Defines interfaces for Cost-Per-Click billing and click tracking.
 */

export interface SponsorCPCSetting {
    id: string;
    sponsor_id: string;
    event_id: string;
    cost_per_click: number;
    max_budget: number;
    current_spent: number;
    is_active: boolean;
    sponsor_name: string;
    logo_url: string;
    target_url: string;
}

export interface ClickTrackingRequest {
    sponsorSettingId: string;
    eventId: string;
    userId: string | null;
    ipAddress: string;
}

export interface ClickTrackingResponse {
    success: boolean;
    redirectUrl: string;
    isBudgetExhausted: boolean;
    message?: string;
}
