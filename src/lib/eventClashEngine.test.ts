import { describe, it, expect } from 'vitest';
import {
  calculateTagJaccardSimilarity,
  calculateTemporalProximity,
  computeAudienceClashMetric,
  generateRescheduleRecommendations,
  layoutClashGraphNodes,
  analyzeEventClashes,
} from './eventClashEngine';
import {
  ScheduledEventSummary,
  EventClashInput,
} from '../types/eventClashGraph';

describe('Event Clash Calculation Engine (#4140)', () => {
  const proposedEvent: ScheduledEventSummary = {
    id: 'proposed-wit',
    title: 'Women in Tech Networking',
    club_id: 'club-wit',
    club_name: 'Women in Tech',
    start_time: '2026-08-27T18:00:00Z',
    end_time: '2026-08-27T20:30:00Z',
    tags: ['tech', 'networking', 'coding'],
    expected_attendance: 150,
  };

  const csEvent: ScheduledEventSummary = {
    id: 'comp-cs',
    title: 'Computer Science Club Mixer',
    club_id: 'club-cs',
    club_name: 'Computer Science Society',
    start_time: '2026-08-27T18:00:00Z',
    end_time: '2026-08-27T20:30:00Z',
    tags: ['tech', 'networking', 'career'],
    expected_attendance: 180,
  };

  const musicEvent: ScheduledEventSummary = {
    id: 'comp-music',
    title: 'Acoustic Jam',
    club_id: 'club-music',
    club_name: 'Music Club',
    start_time: '2026-08-27T18:00:00Z',
    end_time: '2026-08-27T19:30:00Z',
    tags: ['music', 'social'],
    expected_attendance: 40,
  };

  it('calculates Jaccard similarity accurately for demographic tags', () => {
    const { similarity, sharedTags } = calculateTagJaccardSimilarity(
      ['tech', 'networking', 'coding'],
      ['tech', 'networking', 'career']
    );

    // Shared: 2 ('tech', 'networking'), Union: 4 ('tech', 'networking', 'coding', 'career') -> 0.5
    expect(similarity).toBe(0.5);
    expect(sharedTags).toEqual(['tech', 'networking']);
  });

  it('computes temporal proximity overlap and decay within 4-hour window', () => {
    const startA = new Date('2026-08-27T18:00:00Z');
    const endA = new Date('2026-08-27T20:00:00Z');
    const startB = new Date('2026-08-27T18:30:00Z');
    const endB = new Date('2026-08-27T20:30:00Z');

    const result = calculateTemporalProximity(startA, endA, startB, endB);
    expect(result.overlapMinutes).toBe(90);
    expect(result.proximityFactor).toBeGreaterThanOrEqual(0.85);
  });

  it('flags massive demographic clash when high historical RSVP overlap and tags collide', () => {
    const metric = computeAudienceClashMetric(proposedEvent, csEvent, 64);

    expect(metric.composite_clash_score).toBeGreaterThanOrEqual(48);
    expect(metric.clash_severity).toMatch(/high|critical/);
    expect(metric.cannibalization_risk_summary).toContain('cannibalization');
  });

  it('scores low clash severity for unrelated clubs with zero tag intersection', () => {
    const metric = computeAudienceClashMetric(proposedEvent, musicEvent, 10);

    expect(metric.composite_clash_score).toBeLessThan(30);
    expect(metric.clash_severity).toMatch(/none|low|medium/);
  });

  it('generates conflict-free reschedule alternative time slots', () => {
    const recommendations = generateRescheduleRecommendations(
      proposedEvent,
      [csEvent, musicEvent],
      { 'club-cs': 64, 'club-music': 10 }
    );

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].is_optimal).toBe(true);
    expect(recommendations[0].projected_clash_score).toBeLessThanOrEqual(
      recommendations[recommendations.length - 1].projected_clash_score
    );
  });

  it('lays out graph nodes radially with center proposed node', () => {
    const { nodes, edges } = layoutClashGraphNodes(
      proposedEvent,
      [csEvent, musicEvent],
      [],
      600,
      400
    );

    expect(nodes.length).toBe(3);
    const center = nodes.find((n) => n.is_proposed);
    expect(center?.x).toBe(300);
    expect(center?.y).toBe(200);
  });

  it('runs full analyzeEventClashes coordinator workflow', () => {
    const input: EventClashInput = {
      title: 'Women in Tech Networking',
      club_id: 'club-wit',
      club_name: 'Women in Tech',
      start_time: '2026-08-27T18:00:00Z',
      end_time: '2026-08-27T20:30:00Z',
      tags: ['tech', 'networking'],
    };

    const analysis = analyzeEventClashes(input, [csEvent, musicEvent], {
      'club-cs': 64,
      'club-music': 10,
    });

    expect(analysis.nodes.length).toBe(3);
    expect(analysis.edges.length).toBe(2);
    expect(analysis.verdict).toBeDefined();
    expect(analysis.reschedule_recommendations.length).toBeGreaterThan(0);
  });
});
