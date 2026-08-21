export interface ClubSuggestion {
    id: string;
    club_id: string;
    message_text: string;
    toxicity_score: number;
    is_quarantined: boolean;
    submitted_at: string;
    client_ip_hash: string;
    status: 'UNREAD' | 'REVIEWED' | 'ACTIONED';
    created_at: string;
    updated_at: string;
}

export interface SuggestionSubmission {
    message_text: string;
}
