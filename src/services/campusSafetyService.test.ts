import { describe, it, expect, vi, beforeEach } from 'vitest';
import { campusSafetyService, MOCK_SAFETY_REPORTS, MOCK_CAMPUS_INFRASTRUCTURE } from './campusSafetyService';

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('../lib/supabase/client', () => {
  return {
    createClient: vi.fn(() => ({
      from: mockFrom,
      rpc: mockRpc,
    })),
  };
});

describe('Campus Safety Service (#4139)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches safety reports and fallback infrastructure data', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: MOCK_SAFETY_REPORTS, error: null }),
    });

    const reports = await campusSafetyService.fetchSafetyReports();
    expect(reports.length).toBeGreaterThan(0);
    expect(reports[0]).toHaveProperty('report_type');
    expect(reports[0]).toHaveProperty('severity');

    const infra = await campusSafetyService.fetchInfrastructure();
    expect(infra.length).toBeGreaterThan(0);
    expect(infra[0]).toHaveProperty('infrastructure_type');
  });

  it('submits an anonymous safety hazard report successfully', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'report-new',
          latitude: 40.7162,
          longitude: -74.0081,
          report_type: 'poor_lighting',
          severity: 'high',
          description: 'Streetlights out along physics corridor',
          is_anonymous: true,
          status: 'active',
          upvotes: 1,
          verified_by_security: false,
          incident_timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      }),
    });

    const res = await campusSafetyService.submitSafetyReport({
      latitude: 40.7162,
      longitude: -74.0081,
      report_type: 'poor_lighting',
      severity: 'high',
      description: 'Streetlights out along physics corridor',
      is_anonymous: true,
    });

    expect(res.success).toBe(true);
    expect(res.report).toBeDefined();
    expect(res.report?.is_anonymous).toBe(true);
    expect(res.report?.severity).toBe('high');
  });

  it('computes safe walk route plan between two campus nodes', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: MOCK_SAFETY_REPORTS, error: null }),
    });

    const plan = await campusSafetyService.getSafeRoutePlan(
      { latitude: 40.714, longitude: -74.01 },
      { latitude: 40.72, longitude: -74.004 }
    );

    expect(plan.safest_route.total_distance_meters).toBeGreaterThan(0);
    expect(plan.safest_route.estimated_duration_minutes).toBeGreaterThan(0);
    expect(plan.safest_route.overall_safety_score).toBeGreaterThanOrEqual(0);
  });
});
