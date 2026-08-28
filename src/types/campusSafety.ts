/**
 * Campus Safety Heatmap and Dynamic Route Penalization Types
 * Issue #4139
 */

export type SafetyReportType =
  | 'poor_lighting'
  | 'suspicious_activity'
  | 'harassment'
  | 'physical_hazard'
  | 'emergency_callbox_broken'
  | 'isolated_pathway'
  | 'theft_incident'
  | 'other';

export type SafetySeverity = 'low' | 'medium' | 'high' | 'critical';

export type SafetyReportStatus =
  | 'active'
  | 'verified'
  | 'under_investigation'
  | 'resolved'
  | 'dismissed';

export interface SafetyReport {
  id: string;
  latitude: number;
  longitude: number;
  report_type: SafetyReportType;
  severity: SafetySeverity;
  description?: string;
  is_anonymous: boolean;
  reporter_id?: string | null;
  status: SafetyReportStatus;
  upvotes: number;
  verified_by_security: boolean;
  incident_timestamp: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

export interface SafetyReportInput {
  latitude: number;
  longitude: number;
  report_type: SafetyReportType;
  severity: SafetySeverity;
  description?: string;
  is_anonymous?: boolean;
}

export interface SafetyHeatmapPoint {
  id: string;
  latitude: number;
  longitude: number;
  report_type: SafetyReportType;
  severity: SafetySeverity;
  weight: number; // 0.0 to 1.0 (normalized intensity)
  incident_timestamp: string;
  description?: string;
}

export interface GeoLocationPoint {
  latitude: number;
  longitude: number;
  name?: string;
}

export interface CampusInfrastructureNode {
  id: string;
  name: string;
  infrastructure_type:
    | 'emergency_callbox'
    | 'high_intensity_lighting'
    | 'security_booth'
    | 'safe_haven_building';
  latitude: number;
  longitude: number;
  is_operational: boolean;
}

export interface SafetyZoneRisk {
  latitude: number;
  longitude: number;
  risk_level: 'safe' | 'caution' | 'danger'; // Green, Yellow, Red
  hazard_score: number; // 0 (safest) to 100 (most hazardous)
  primary_factor?: string;
  recent_incidents_count: number;
}

export interface SafeRouteSegment {
  from: GeoLocationPoint;
  to: GeoLocationPoint;
  distance_meters: number;
  risk_score: number; // 0 - 100
  zone_color: 'green' | 'yellow' | 'red';
  is_well_lit: boolean;
  has_emergency_phone_in_range: boolean;
  segment_penalty: number;
}

export type DroneDispatchStatus = 'DISPATCHED' | 'EN_ROUTE' | 'ON_SCENE' | 'CANCELLED' | 'FAILED';

export interface DroneDispatchRecord {
  id: string;
  safety_check_response_id: string;
  student_user_id: string;
  target_latitude: number;
  target_longitude: number;
  status: DroneDispatchStatus;
  drone_api_dispatch_id?: string | null;
  hls_playback_url?: string | null;
  dispatched_at: string;
  updated_at: string;
}
export interface SafeRouteComparison {
  route_type: 'safest_safe_corridor' | 'standard_shortest';
  waypoints: GeoLocationPoint[];
  total_distance_meters: number;
  estimated_duration_minutes: number;
  overall_safety_score: number; // 0 - 100 (Higher is safer)
  red_zones_avoided: number;
  well_lit_percentage: number;
  emergency_callbox_coverage_percentage: number;
  segments: SafeRouteSegment[];
  safety_advisories: string[];
}

export interface SafeWalkRouteResult {
  safest_route: SafeRouteComparison;
  shortest_route: SafeRouteComparison;
  safety_gain_percentage: number;
  extra_walking_time_minutes: number;
  active_hazards_nearby: SafetyReport[];
}
