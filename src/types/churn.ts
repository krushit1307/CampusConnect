export interface DonorInteractionEvent {
  id: string;
  user_id: string;
  club_id?: string;
  interaction_type: "email_open" | "rsvp" | "login" | "donation" | "feedback";
  weight: number;
  occurred_at: string;
}

export interface DonorChurnPrediction {
  id: string;
  user_id: string;
  club_id: string;
  baseline_velocity: number;
  current_velocity: number;
  velocity_change_pct: number;
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  contributing_factors: string[];
  is_high_value_donor: boolean;
  total_donation_volume_cents: number;
  last_meaningful_interaction_at: string | null;
  alert_task_id?: string;
  calculated_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
  };
}

export interface ChurnModelerResponse {
  success: boolean;
  processed: number;
  error?: string;
}

export interface ChurnModelerPayload {
  club_id: string;
}
