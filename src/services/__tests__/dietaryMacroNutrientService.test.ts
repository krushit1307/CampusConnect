import { describe, it, expect } from "vitest";
import {
  PRESET_CAMPUS_DISHES,
  calculateMacroRatios,
  evaluateDietaryCompliance,
  fetchDishMacroNutrients,
  calculateMenuMacroTotals,
} from "../dietaryMacroNutrientService";

describe("Dietary Macro-Nutrient API Service", () => {
  describe("calculateMacroRatios", () => {
    it("computes protein %, carbs %, and fat % from macro grams", () => {
      const ratios = calculateMacroRatios({
        calories: 500,
        proteinGrams: 25, // 100 cals = 20%
        carbsGrams: 50, // 200 cals = 40%
        fatGrams: 22.2, // 200 cals = 40%
        fiberGrams: 5,
        sugarGrams: 2,
        sodiumMg: 300,
      });

      expect(ratios.proteinPct).toBeGreaterThan(15);
      expect(ratios.carbsPct).toBeGreaterThan(30);
      expect(ratios.fatPct).toBeGreaterThan(30);
      expect(ratios.proteinPct + ratios.carbsPct + ratios.fatPct).toBeCloseTo(100, -1);
    });
  });

  describe("evaluateDietaryCompliance", () => {
    it("passes compliance when dish meets user dietary restrictions", () => {
      const quinoa = PRESET_CAMPUS_DISHES["quinoa-power-bowl"];
      const result = evaluateDietaryCompliance(quinoa.macros, quinoa.flags, {
        veganOnly: true,
        glutenFreeOnly: true,
        nutFreeOnly: true,
      });

      expect(result.isCompliant).toBe(true);
      expect(result.warnings.length).toBe(0);
    });

    it("flags warnings when dish violates user dietary restrictions (e.g. Keto carb limit)", () => {
      const quinoa = PRESET_CAMPUS_DISHES["quinoa-power-bowl"]; // 54g carbs
      const result = evaluateDietaryCompliance(quinoa.macros, quinoa.flags, {
        ketoOnly: true, // limit 20g
      });

      expect(result.isCompliant).toBe(false);
      expect(result.warnings[0]).toContain("exceed Keto limit");
    });
  });

  describe("fetchDishMacroNutrients", () => {
    it("returns nutrient analysis result for preset dish", () => {
      const analysis = fetchDishMacroNutrients("quinoa-power-bowl");

      expect(analysis.dishName).toBe("Mediterranean Quinoa Power Bowl");
      expect(analysis.macros.calories).toBe(420);
      expect(analysis.healthScore).toBeGreaterThan(50);
      expect(analysis.apiSource).toBe("Campus Nutrition Knowledge Base");
    });
  });

  describe("calculateMenuMacroTotals", () => {
    it("aggregates total macros across multiple menu dishes", () => {
      const dish1 = fetchDishMacroNutrients("quinoa-power-bowl");
      const dish2 = fetchDishMacroNutrients("grilled-chicken-salad");

      const totals = calculateMenuMacroTotals([dish1, dish2]);
      expect(totals.calories).toBe(dish1.macros.calories + dish2.macros.calories);
      expect(totals.proteinGrams).toBe(dish1.macros.proteinGrams + dish2.macros.proteinGrams);
    });
  });
});
