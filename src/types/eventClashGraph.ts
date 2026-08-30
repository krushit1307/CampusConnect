/**
 * Event Clash Dependency Graph & Audience Cannibalization Types
 * Issue #4140
 */

export type ClashSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface EventDemographicTag {
  id: string;
  name: string;
  category?: string;
  weight?: number;
}

export interface ScheduledEventSummary {
  id: string;
  title: string;
  club_id: string;
  club_name: string;
  club_logo_url?: string;
  start_time: string;
  end_time: string;
  location?: string;
  tags: string[];
  expected_attendance: number;
  is_target_proposed?: boolean;
}

export interface AudienceOverlapMetric {
  shared_tag_count: number;
  tag_jaccard_similarity: number; // 0.0 - 1.0
  historical_rsvp_overlap_percentage: number; // 0% - 100%
  temporal_overlap_minutes: number;
  time_proximity_factor: number; // 1.0 (exact clash) to 0.1 (4h apart)
  composite_clash_score: number; // 0 - 100
  clash_severity: ClashSeverity;
  cannibalization_risk_summary: string;
}

export interface ClashGraphNode {
  id: string;
  title: string;
  club_name: string;
  club_id: string;
  start_time: string;
  end_time: string;
  tags: string[];
  attendance: number;
  is_proposed: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  radius?: number;
}

export interface ClashGraphEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  clash_score: number; // 0 - 100
  severity: ClashSeverity;
  overlap_metric: AudienceOverlapMetric;
  stroke_width: number;
  color: string;
  is_critical_clash: boolean;
}

export interface RescheduleAlternativeSlot {
  start_time: string;
  end_time: string;
  day_offset: number; // e.g. 0 (same day), +1 (tomorrow), +2
  hour_offset: number;
  projected_clash_score: number;
  conflicting_events_count: number;
  recommendation_reason: string;
  is_optimal: boolean;
}

export interface EventClashAnalysisResult {
  proposed_event: ScheduledEventSummary;
  concurrent_events_analyzed: number;
  highest_clash_score: number;
  overall_clash_severity: ClashSeverity;
  nodes: ClashGraphNode[];
  edges: ClashGraphEdge[];
  reschedule_recommendations: RescheduleAlternativeSlot[];
  audience_cannibalization_breakdown: {
    event_id: string;
    event_title: string;
    club_name: string;
    metric: AudienceOverlapMetric;
  }[];
  verdict: {
    status: 'clear' | 'minor_warning' | 'reschedule_recommended' | 'severe_clash_blocker';
    headline: string;
    advice: string;
  };
}

export interface EventClashInput {
  title: string;
  club_id: string;
  club_name: string;
  start_time: string;
  end_time: string;
  tags: string[];
  expected_attendance?: number;
  location?: string;
}
