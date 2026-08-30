/**
 * Campus Dining Hall Meal Plan Subscription Telemetry Utilities
 */

export interface MealPlanMetrics {
  mealsRemainingThisWeek: number;
  diningDollarsBalanceUSD: number;
  isNutritionalGoalMet: boolean;
}

/**
 * Evaluates student weekly dining hall meal plan usage.
 */
export function evaluateStudentMealPlanUsage(
  initialWeeklyMeals: number,
  mealsUsedThisWeek: number,
  diningDollarsUSD: number
): MealPlanMetrics {
  const remaining = Math.max(0, initialWeeklyMeals - mealsUsedThisWeek);

  return {
    mealsRemainingThisWeek: remaining,
    diningDollarsBalanceUSD: diningDollarsUSD,
    isNutritionalGoalMet: mealsUsedThisWeek >= 14,
  };
}
