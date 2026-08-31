/**
 * Unit Tests for Campus Dining Utilities
 */

import { describe, it, expect } from 'vitest';
import { evaluateStudentMealPlanUsage } from './campusDiningUtils';

describe('CampusDiningUtils', () => {
  it('should calculate remaining weekly meals and dining dollars balance', () => {
    const res = evaluateStudentMealPlanUsage(21, 14, 150.00);
    expect(res.mealsRemainingThisWeek).toBe(7);
    expect(res.isNutritionalGoalMet).toBe(true);
  });
});
