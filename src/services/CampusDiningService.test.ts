import { describe, it, expect } from 'vitest';
import { CampusDiningService } from '../../backend/src/services/CampusDiningService';

describe('CampusDiningService', () => {
  it('should fetch dining venues and allergen metadata', () => {
    const venues = CampusDiningService.getVenues();
    expect(venues.length).toBeGreaterThan(0);
    expect(venues[0].calorieCountApprox).toBeGreaterThan(0);
    expect(venues[0].proteinGrams).toBeGreaterThan(0);
  });

  it('should redeem meal swipe and log nutrition automatically', () => {
    const pass = CampusDiningService.redeemSwipe('STU-999', 'HALL-NORTH-01');
    expect(pass.remainingMealSwipes).toBe(41);
    expect(pass.totalSwipesRedeemed).toBe(19);

    const nutrition = CampusDiningService.getNutritionGoals('STU-999');
    expect(nutrition.consumedCaloriesToday).toBeGreaterThan(1500);
  });

  it('should log water intake correctly', () => {
    const goals = CampusDiningService.logWaterIntake('STU-999', 0.5);
    expect(goals.waterIntakeLitersToday).toBeGreaterThan(2.0);
  });

  it('should return service dining metrics', () => {
    const metrics = CampusDiningService.getDiningMetrics();
    expect(metrics.totalVenuesOpen).toBeGreaterThan(0);
    expect(metrics.telemetryStatus).toBe('LIVE_SENSOR_GRID_OK');
  });
});
