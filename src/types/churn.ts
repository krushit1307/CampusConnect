/**
 * Churn Prediction Types for CampusConnect
 * Defines interfaces for engagement signals, risk scoring, and predictive modeling.
 */

export interface EngagementSignal {
    signal_type: 'late_arrival' | 'no_questions' | 'no_email_click' | 'missed_session';
    weight: number;
    triggered: boolean;
    details?: string;
}

export interface ChurnRiskAssessment {
    user_id: string;
    event_series_id: string;
    flight_risk_score: number; // 0-100
    risk_level: 'low' | 'medium' | 'high';
    signals: EngagementSignal[];
    last_calculated_at: string;
}

export interface SeriesAttendeeRisk {
    user_id: string;
    full_name: string;
    email: string;
    flight_risk_score: number;
    risk_level: 'low' | 'medium' | 'high';
    primary_signals: string[];
}
