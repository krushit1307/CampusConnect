import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  eventClashGraphService,
  MOCK_SCHEDULED_EVENTS,
  MOCK_HISTORICAL_OVERLAPS,
} from './eventClashGraphService';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('../lib/supabase/client', () => {
  return {
    createClient: vi.fn(() => ({
      from: mockFrom,
    })),
  };
});

describe('Event Clash Graph Service (#4140)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches concurrent events within +/- 4 hour window with fallback mock', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({
        data: MOCK_SCHEDULED_EVENTS,
        error: null,
      }),
    });

    const events = await eventClashGraphService.fetchConcurrentEvents(
      '2026-08-27T18:00:00Z'
    );
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toHaveProperty('title');
    expect(events[0]).toHaveProperty('tags');
  });

  it('fetches historical RSVP overlap for competing clubs', async () => {
    const overlapMap = await eventClashGraphService.fetchHistoricalRsvpOverlap(
      'club-wit',
      ['club-cs', 'club-ai']
    );

    expect(overlapMap['club-cs']).toBe(64);
    expect(overlapMap['club-ai']).toBe(52);
  });

  it('evaluates full event clash analysis and generates dependency graph', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({
        data: MOCK_SCHEDULED_EVENTS,
        error: null,
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const result = await eventClashGraphService.evaluateEventClashes({
      title: 'Women in Tech Networking',
      club_id: 'club-wit',
      club_name: 'Women in Tech',
      start_time: '2026-08-27T18:00:00Z',
      end_time: '2026-08-27T20:30:00Z',
      tags: ['tech', 'networking', 'career'],
      expected_attendance: 150,
    });

    expect(result.nodes.length).toBeGreaterThan(1);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(result.reschedule_recommendations.length).toBeGreaterThan(0);
  });
});
