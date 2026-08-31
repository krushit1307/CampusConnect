import { describe, it, expect } from 'vitest';
import {
  calculateHistoricalDietaryRatios,
  predictDietaryBreakdown,
  DEFAULT_CAMPUS_DIETARY_PRIORS,
} from './dietaryPredictiveModel';
import { HistoricalEventDietarySample } from '../types/dietaryPredictiveModel';

describe('Dietary Restriction Predictive Model (#4290)', () => {
  const sampleEvents: HistoricalEventDietarySample[] = [
    {
      id: 's1',
      event_id: 'e1',
      event_title: 'Hackathon 1',
      event_date: '2025-10-01T00:00:00Z',
      total_attendees: 100,
      breakdown: {
        vegan: 10,
        vegetarian: 15,
        gluten_free: 5,
        halal: 8,
        kosher: 2,
        dairy_free: 4,
        nut_allergy: 3,
        general: 53,
      },
    },
    {
      id: 's2',
      event_id: 'e2',
      event_title: 'Hackathon 2',
      event_date: '2025-11-01T00:00:00Z',
      total_attendees: 100,
      breakdown: {
        vegan: 10,
        vegetarian: 15,
        gluten_free: 5,
        halal: 8,
        kosher: 2,
        dairy_free: 4,
        nut_allergy: 3,
        general: 53,
      },
    },
  ];

  it('calculates historical empirical dietary ratios across past events', () => {
    const { ratios, totalAttendeesSampled, eventsCount } =
      calculateHistoricalDietaryRatios(sampleEvents);

    expect(eventsCount).toBe(2);
    expect(totalAttendeesSampled).toBe(200);
    expect(ratios.vegan).toBeCloseTo(0.10, 1);
    expect(ratios.vegetarian).toBeCloseTo(0.14, 1);
    expect(ratios.gluten_free).toBeCloseTo(0.05, 1);
  });

  it('multiplies historical ratios by upcoming venue capacity (e.g. 500 capacity * 10% = 50 vegans)', () => {
    const prediction = predictDietaryBreakdown(500, sampleEvents, 10.0);

    expect(prediction.venue_capacity).toBe(500);
    expect(prediction.categories.vegan.predicted_headcount).toBe(50);
    // With +10% buffer, 50 * 1.10 = 55
    expect(prediction.categories.vegan.safety_buffer_headcount).toBe(55);
  });

  it('includes algorithmic estimate caveat disclaimer in output', () => {
    const prediction = predictDietaryBreakdown(300, sampleEvents);

    expect(prediction.is_algorithmic_estimate).toBe(true);
    expect(prediction.disclaimer_notice).toContain('Algorithmic Baseline Estimate');
  });

  it('computes 95% confidence intervals for every dietary restriction category', () => {
    const prediction = predictDietaryBreakdown(500, sampleEvents);

    const gf = prediction.categories.gluten_free;
    expect(gf.confidence_lower_bound).toBeLessThanOrEqual(gf.predicted_headcount);
    expect(gf.confidence_upper_bound).toBeGreaterThanOrEqual(gf.predicted_headcount);
  });

  it('falls back gracefully to campus demographic priors when no past events exist', () => {
    const prediction = predictDietaryBreakdown(100, []);

    expect(prediction.categories.vegan.predicted_headcount).toBe(10);
    expect(prediction.categories.vegetarian.predicted_headcount).toBe(12);
  });
});
