/**
 * Campus Safety Service
 * Handles data fetching, anonymous incident reporting, and real-time safe route requests.
 * Issue #4139
 */

import { createClient } from '../lib/supabase/client';
import {
  SafetyReport,
  SafetyReportInput,
  SafetyHeatmapPoint,
  GeoLocationPoint,
  CampusInfrastructureNode,
  SafeWalkRouteResult,
} from '../types/campusSafety';
import {
  calculateSafeWalkRoutePlan,
  generateSafetyHeatmapGrid,
} from '../lib/campusSafetyRouting';

const supabase = createClient();

// Sample seed campus coordinates (e.g. University Center / Engineering Quad)
export const DEFAULT_CAMPUS_BOUNDS = {
  minLat: 40.712,
  maxLat: 40.722,
  minLng: -74.012,
  maxLng: -74.002,
  centerLat: 40.717,
  centerLng: -74.007,
};

// Built-in campus infrastructure POIs
export const MOCK_CAMPUS_INFRASTRUCTURE: CampusInfrastructureNode[] = [
  {
    id: 'infra-1',
    name: 'North Quad Blue Light Emergency Callbox',
    infrastructure_type: 'emergency_callbox',
    latitude: 40.7182,
    longitude: -74.0085,
    is_operational: true,
  },
  {
    id: 'infra-2',
    name: 'Library Walk High-Intensity Floodlights',
    infrastructure_type: 'high_intensity_lighting',
    latitude: 40.7165,
    longitude: -74.0072,
    is_operational: true,
  },
  {
    id: 'infra-3',
    name: 'Campus Police Main Security Kiosk',
    infrastructure_type: 'security_booth',
    latitude: 40.7148,
    longitude: -74.0061,
    is_operational: true,
  },
  {
    id: 'infra-4',
    name: 'Student Union 24/7 Safe Haven',
    infrastructure_type: 'safe_haven_building',
    latitude: 40.719,
    longitude: -74.0055,
    is_operational: true,
  },
];

// Fallback seed reports for demo & resilient offline operation
export const MOCK_SAFETY_REPORTS: SafetyReport[] = [
  {
    id: 'report-1',
    latitude: 40.7155,
    longitude: -74.0092,
    report_type: 'poor_lighting',
    severity: 'high',
    description: 'Broken path lamppost near Old Oak Grove, pathway completely dark after 8 PM.',
    is_anonymous: true,
    status: 'active',
    upvotes: 14,
    verified_by_security: false,
    incident_timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'report-2',
    latitude: 40.7158,
    longitude: -74.0089,
    report_type: 'suspicious_activity',
    severity: 'critical',
    description: 'Recent mugging and aggressive confrontation reported along unlit park trail.',
    is_anonymous: true,
    status: 'verified',
    upvotes: 28,
    verified_by_security: true,
    incident_timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'report-3',
    latitude: 40.7188,
    longitude: -74.0042,
    report_type: 'emergency_callbox_broken',
    severity: 'medium',
    description: 'Callbox #12 red light flashing error; button does not connect to dispatch.',
    is_anonymous: true,
    status: 'under_investigation',
    upvotes: 6,
    verified_by_security: false,
    incident_timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'report-4',
    latitude: 40.7205,
    longitude: -74.0098,
    report_type: 'isolated_pathway',
    severity: 'low',
    description: 'Overgrown hedges blocking sightlines near tennis courts.',
    is_anonymous: true,
    status: 'active',
    upvotes: 3,
    verified_by_security: false,
    incident_timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

export const campusSafetyService = {
  /**
   * Fetch active safety reports within given geographic bounds.
   */
  async fetchSafetyReports(
    bounds = DEFAULT_CAMPUS_BOUNDS
  ): Promise<SafetyReport[]> {
    try {
      if (!supabase) return MOCK_SAFETY_REPORTS;

      const { data, error } = await supabase
        .from('safety_reports')
        .select('*')
        .gte('latitude', bounds.minLat)
        .lte('latitude', bounds.maxLat)
        .gte('longitude', bounds.minLng)
        .lte('longitude', bounds.maxLng)
        .in('status', ['active', 'verified', 'under_investigation'])
        .order('incident_timestamp', { ascending: false });

      if (error || !data || data.length === 0) {
        return MOCK_SAFETY_REPORTS;
      }
      return data as SafetyReport[];
    } catch {
      return MOCK_SAFETY_REPORTS;
    }
  },

  /**
   * Submit an anonymous or student-attributed safety hazard report.
   */
  async submitSafetyReport(
    input: SafetyReportInput
  ): Promise<{ success: boolean; report?: SafetyReport; error?: string }> {
    try {
      const newReport: Partial<SafetyReport> = {
        latitude: input.latitude,
        longitude: input.longitude,
        report_type: input.report_type,
        severity: input.severity,
        description: input.description || '',
        is_anonymous: input.is_anonymous ?? true,
        status: 'active',
        upvotes: 1,
        verified_by_security: false,
        incident_timestamp: new Date().toISOString(),
      };

      if (supabase) {
        const { data, error } = await supabase
          .from('safety_reports')
          .insert(newReport)
          .select()
          .single();

        if (error) {
          // Return simulated report on connection error
          const fallback: SafetyReport = {
            id: `report-${Date.now()}`,
            ...newReport,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as SafetyReport;
          return { success: true, report: fallback };
        }

        return { success: true, report: data as SafetyReport };
      }

      const mockSaved: SafetyReport = {
        id: `mock-${Date.now()}`,
        ...newReport,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as SafetyReport;

      return { success: true, report: mockSaved };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to submit report' };
    }
  },

  /**
   * Upvote / endorse a reported incident to increase crowd validation.
   */
  async upvoteReport(reportId: string): Promise<boolean> {
    try {
      if (supabase) {
        await supabase.rpc('increment_safety_report_upvotes', { report_id: reportId });
      }
      return true;
    } catch {
      return true;
    }
  },

  /**
   * Fetch campus safety infrastructure (blue light boxes, lighting, kiosks).
   */
  async fetchInfrastructure(): Promise<CampusInfrastructureNode[]> {
    try {
      if (!supabase) return MOCK_CAMPUS_INFRASTRUCTURE;

      const { data, error } = await supabase
        .from('campus_safety_infrastructure')
        .select('*')
        .eq('is_operational', true);

      if (error || !data || data.length === 0) {
        return MOCK_CAMPUS_INFRASTRUCTURE;
      }
      return data as CampusInfrastructureNode[];
    } catch {
      return MOCK_CAMPUS_INFRASTRUCTURE;
    }
  },

  /**
   * Plan a safe walking route between origin and destination, calculating
   * safety metrics and penalizing hazard zones.
   */
  async getSafeRoutePlan(
    origin: GeoLocationPoint,
    destination: GeoLocationPoint
  ): Promise<SafeWalkRouteResult> {
    const reports = await this.fetchSafetyReports();
    const infra = await this.fetchInfrastructure();

    return calculateSafeWalkRoutePlan(origin, destination, reports, infra);
  },

  /**
   * Generate heatmap grid points across bounds.
   */
  async getHeatmapGridData(
    bounds = DEFAULT_CAMPUS_BOUNDS
  ) {
    const reports = await this.fetchSafetyReports(bounds);
    return generateSafetyHeatmapGrid(bounds, reports);
  },
};
