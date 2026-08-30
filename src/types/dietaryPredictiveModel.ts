/**
 * Dietary Restriction Predictive Model Types
 * Issue #4290
 */

export type DietaryRestrictionKey =
  | 'vegan'
  | 'vegetarian'
  | 'gluten_free'
  | 'halal'
  | 'kosher'
  | 'dairy_free'
  | 'nut_allergy'
  | 'general';

export interface HistoricalEventDietarySample {
  id: string;
  event_id: string;
  event_title: string;
  event_date: string;
  total_attendees: number;
  breakdown: Record<DietaryRestrictionKey, number>;
}

export interface DietaryCategoryPrediction {
  key: DietaryRestrictionKey;
  label: string;
  historical_ratio: number; // e.g. 0.10 (10%)
  predicted_headcount: number; // e.g. 500 * 0.10 = 50
  safety_buffer_headcount: number; // e.g. 55 with 10% buffer
  confidence_lower_bound: number;
  confidence_upper_bound: number;
  color_code: string;
}

export interface DietaryPredictionResult {
  event_id: string;
  club_id: string;
  club_name: string;
  venue_capacity: number;
  historical_events_analyzed_count: number;
  total_historical_attendees_sampled: number;
  safety_buffer_percentage: number;
  confidence_score: number; // 0.0 - 1.0
  is_algorithmic_estimate: boolean;
  disclaimer_notice: string;
  categories: Record<DietaryRestrictionKey, DietaryCategoryPrediction>;
  total_predicted_meals: number;
  total_recommended_procurement_meals: number;
}

export interface CateringOrderExportPayload {
  event_id: string;
  event_title: string;
  venue_capacity: number;
  target_catering_date: string;
  items: {
    dietary_type: string;
    exact_count: number;
    recommended_order: number;
    allergens_warning: string[];
  }[];
  generated_at: string;
}
