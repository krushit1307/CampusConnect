import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dietaryPredictiveService,
  MOCK_HISTORICAL_DIETARY_EVENTS,
} from './dietaryPredictiveService';

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

describe('Dietary Predictive Service (#4290)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches last 5 historical event dietary records with fallback', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: MOCK_HISTORICAL_DIETARY_EVENTS,
        error: null,
      }),
    });

    const samples = await dietaryPredictiveService.fetchClubHistoricalDietary('club-tech');
    expect(samples.length).toBeGreaterThan(0);
    expect(samples[0]).toHaveProperty('breakdown');
  });

  it('generates predictive breakdown based on venue capacity', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: MOCK_HISTORICAL_DIETARY_EVENTS,
        error: null,
      }),
    });

    const pred = await dietaryPredictiveService.generateDietaryPrediction(
      500,
      'club-tech',
      'evt-gala'
    );

    expect(pred.venue_capacity).toBe(500);
    expect(pred.categories.vegan.predicted_headcount).toBeGreaterThan(0);
    expect(pred.categories.general.predicted_headcount).toBeGreaterThan(0);
    expect(pred.is_algorithmic_estimate).toBe(true);
  });

  it('saves prediction order to database', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const pred = await dietaryPredictiveService.generateDietaryPrediction(250);
    const success = await dietaryPredictiveService.savePredictionOrder(pred);
    expect(success).toBe(true);
  });
});
