import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMealPlan } from "@/hooks/useMealPlan";
import type { DiningHall, MealType } from "@/hooks/useMealPlan";

describe("useMealPlan", () => {
  it("should initialize with mock data", () => {
    const { result } = renderHook(() => useMealPlan());
    expect(result.current.halls.length).toBe(5);
    expect(result.current.swipes.length).toBeGreaterThan(0);
    expect(result.current.plan.swipesRemaining).toBe(112);
    expect(result.current.favorites.length).toBeGreaterThan(0);
    expect(result.current.nutrientLogs.length).toBeGreaterThan(0);
  });

  it("should filter swipes by meal type", () => {
    const { result } = renderHook(() => useMealPlan());
    act(() => result.current.setMealTypeFilter("breakfast"));
    expect(result.current.mealTypeFilter).toBe("breakfast");
  });

  it("should filter swipes by hall", () => {
    const { result } = renderHook(() => useMealPlan());
    act(() => result.current.setHallFilter("commons"));
    expect(result.current.hallFilter).toBe("commons");
  });

  it("should log a new swipe", () => {
    const { result } = renderHook(() => useMealPlan());
    const initial = result.current.swipes.length;
    act(() => {
      result.current.logSwipe({
        userId: "u-self",
        diningHallId: "commons",
        mealType: "lunch",
        date: "2026-08-28",
        time: "12:00",
        items: ["Pasta"],
        calories: 600,
        protein: 20,
        carbs: 80,
        fat: 20,
        cost: 9.0,
      });
    });
    expect(result.current.swipes.length).toBe(initial + 1);
  });

  it("should remove a swipe", () => {
    const { result } = renderHook(() => useMealPlan());
    const first = result.current.swipes[0];
    const initial = result.current.swipes.length;
    act(() => result.current.removeSwipe(first.id));
    expect(result.current.swipes.length).toBe(initial - 1);
  });

  it("should add and remove favorites", () => {
    const { result } = renderHook(() => useMealPlan());
    const initial = result.current.favorites.length;
    act(() => {
      result.current.addFavorite({
        name: "Test Item",
        diningHallId: "commons",
        calories: 400,
        lastOrdered: "2026-08-28",
        orderCount: 1,
      });
    });
    expect(result.current.favorites.length).toBe(initial + 1);
    const newFav = result.current.favorites[result.current.favorites.length - 1];
    act(() => result.current.removeFavorite(newFav.id));
    expect(result.current.favorites.length).toBe(initial);
  });

  it("should compute stats", () => {
    const { result } = renderHook(() => useMealPlan());
    expect(result.current.stats.totalSwipes).toBe(result.current.swipes.length);
    expect(result.current.stats.avgCaloriesPerDay).toBeGreaterThan(0);
    expect(result.current.stats.percentUsed).toBeGreaterThan(0);
    expect(result.current.stats.streakDays).toBeGreaterThanOrEqual(0);
  });

  it("should return calorie trend", () => {
    const { result } = renderHook(() => useMealPlan());
    const trend = result.current.getCalorieTrend();
    expect(trend.length).toBeGreaterThan(0);
    trend.forEach((t) => {
      expect(t.date).toBeTruthy();
      expect(t.calories).toBeGreaterThan(0);
    });
  });

  it("should return nutrient breakdown", () => {
    const { result } = renderHook(() => useMealPlan());
    const breakdown = result.current.getNutrientBreakdown();
    expect(breakdown.length).toBe(3);
    breakdown.forEach((n) => {
      expect(n.label).toBeTruthy();
      expect(n.percentage).toBeGreaterThanOrEqual(0);
      expect(n.percentage).toBeLessThanOrEqual(100);
    });
  });

  it("should return recommendations", () => {
    const { result } = renderHook(() => useMealPlan());
    const recs = result.current.getRecommendations();
    expect(recs.length).toBeLessThanOrEqual(3);
    recs.forEach((r) => expect(r.isOpen).toBe(true));
  });

  it("should return meal plan projection", () => {
    const { result } = renderHook(() => useMealPlan());
    const proj = result.current.getMealPlanProjection();
    expect(proj.length).toBeGreaterThan(0);
    proj.forEach((p) => {
      expect(p.week).toBeGreaterThan(0);
      expect(p.projected).toBeGreaterThanOrEqual(0);
    });
  });

  it("should get hall by id", () => {
    const { result } = renderHook(() => useMealPlan());
    const hall = result.current.getHallById("commons");
    expect(hall).toBeDefined();
    expect(hall?.name).toBe("Main Commons");
  });

  it("should get swipes by hall", () => {
    const { result } = renderHook(() => useMealPlan());
    const hallSwipes = result.current.getSwipesByHall("commons");
    hallSwipes.forEach((s) => expect(s.diningHallId).toBe("commons"));
  });

  it("should get swipes by date", () => {
    const { result } = renderHook(() => useMealPlan());
    const dateSwipes = result.current.getSwipesByDate("2026-08-28");
    dateSwipes.forEach((s) => expect(s.date).toBe("2026-08-28"));
  });
});
