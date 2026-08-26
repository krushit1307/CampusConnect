import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistance,
  computePointHazardScore,
  evaluateInfrastructureCoverage,
  getZoneColorFromHazardScore,
  calculateEdgeCost,
  findOptimalWalkPath,
  calculateSafeWalkRoutePlan,
  generateSafetyHeatmapGrid,
} from './campusSafetyRouting';
import {
  SafetyReport,
  GeoLocationPoint,
  CampusInfrastructureNode,
} from '../types/campusSafety';

describe('Campus Safety Routing Engine (#4139)', () => {
  const origin: GeoLocationPoint = { latitude: 40.714, longitude: -74.01 };
  const destination: GeoLocationPoint = { latitude: 40.72, longitude: -74.004 };

  const mockIncidents: SafetyReport[] = [
    {
      id: 'inc-1',
      latitude: 40.716,
      longitude: -74.008,
      report_type: 'poor_lighting',
      severity: 'high',
      description: 'Completely unlit park path',
      is_anonymous: true,
      status: 'active',
      upvotes: 10,
      verified_by_security: false,
      incident_timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'inc-2',
      latitude: 40.717,
      longitude: -74.007,
      report_type: 'suspicious_activity',
      severity: 'critical',
      description: 'Reported mugging',
      is_anonymous: true,
      status: 'verified',
      upvotes: 25,
      verified_by_security: true,
      incident_timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockInfrastructure: CampusInfrastructureNode[] = [
    {
      id: 'infra-1',
      name: 'Quad High-Intensity Lighting',
      infrastructure_type: 'high_intensity_lighting',
      latitude: 40.715,
      longitude: -74.009,
      is_operational: true,
    },
    {
      id: 'infra-2',
      name: 'Emergency Callbox #4',
      infrastructure_type: 'emergency_callbox',
      latitude: 40.718,
      longitude: -74.006,
      is_operational: true,
    },
  ];

  it('calculates accurate Haversine distance between geographical coordinates', () => {
    const p1 = { latitude: 40.714, longitude: -74.01 };
    const p2 = { latitude: 40.72, longitude: -74.004 };
    const dist = calculateHaversineDistance(p1, p2);

    expect(dist).toBeGreaterThan(700);
    expect(dist).toBeLessThan(1200);
  });

  it('computes high KDE hazard score near critical incident hotspots', () => {
    // Exact location of critical incident
    const hotspot = { latitude: 40.717, longitude: -74.007 };
    const hazardScore = computePointHazardScore(hotspot, mockIncidents);

    expect(hazardScore).toBeGreaterThanOrEqual(25);
    expect(getZoneColorFromHazardScore(hazardScore)).toBe('red');
  });

  it('computes near-zero hazard score far from reported incidents', () => {
    const farPoint = { latitude: 40.75, longitude: -74.05 };
    const hazardScore = computePointHazardScore(farPoint, mockIncidents);

    expect(hazardScore).toBe(0);
    expect(getZoneColorFromHazardScore(hazardScore)).toBe('green');
  });

  it('evaluates well-lit and emergency callbox infrastructure coverage correctly', () => {
    const nearLight = { latitude: 40.715, longitude: -74.009 };
    const coverage = evaluateInfrastructureCoverage(nearLight, mockInfrastructure);

    expect(coverage.isWellLit).toBe(true);

    const farPoint = { latitude: 40.79, longitude: -74.09 };
    const farCoverage = evaluateInfrastructureCoverage(farPoint, mockInfrastructure);
    expect(farCoverage.isWellLit).toBe(false);
    expect(farCoverage.hasCallboxInRange).toBe(false);
  });

  it('applies quadratic penalty multiplier to edge costs when routing through hazard zones', () => {
    const p1 = { latitude: 40.716, longitude: -74.008 };
    const p2 = { latitude: 40.717, longitude: -74.007 };

    const rawCost = calculateEdgeCost(p1, p2, 80, false, false, false);
    const penalizedCost = calculateEdgeCost(p1, p2, 80, false, false, true);

    expect(penalizedCost).toBeGreaterThan(rawCost * 3);
  });

  it('generates safest walking route that scores higher safety rating than direct shortest path', () => {
    const plan = calculateSafeWalkRoutePlan(
      origin,
      destination,
      mockIncidents,
      mockInfrastructure
    );

    expect(plan.safest_route).toBeDefined();
    expect(plan.shortest_route).toBeDefined();
    expect(plan.safest_route.overall_safety_score).toBeGreaterThanOrEqual(
      plan.shortest_route.overall_safety_score
    );
    expect(plan.safest_route.waypoints.length).toBeGreaterThan(2);
    expect(plan.safest_route.segments.length).toBeGreaterThan(0);
  });

  it('generates heatmap grid matrix covering campus boundaries', () => {
    const bounds = {
      minLat: 40.712,
      maxLat: 40.722,
      minLng: -74.012,
      maxLng: -74.002,
    };
    const grid = generateSafetyHeatmapGrid(bounds, mockIncidents, 5);

    expect(grid.length).toBeGreaterThan(20);
    expect(grid[0]).toHaveProperty('hazard_score');
    expect(grid[0]).toHaveProperty('risk_level');
  });
});
