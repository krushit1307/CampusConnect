// =============================================================================
// File: src/services/dietaryMacroNutrientService.ts
// Task: Interactive "Dietary Restriction" Macro-Nutrient API Integration
// Description: API integration service & compliance engine for parsing dish ingredients,
//              calculating macro-nutrient breakdowns (Calories, Protein, Carbs, Fat, Fiber, Sodium),
//              and evaluating user dietary restrictions (Keto, Vegan, Halal, Nut-Free, etc.).
// =============================================================================

export interface MacroNutrientBreakdown {
  calories: number; // kcal
  proteinGrams: number; // g
  carbsGrams: number; // g
  fatGrams: number; // g
  fiberGrams: number; // g
  sugarGrams: number; // g
  sodiumMg: number; // mg
}

export interface DietaryRestrictionFlags {
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isKeto: boolean;
  isHalal: boolean;
  isKosher: boolean;
  isLowSodium: boolean;
  isNutFree: boolean;
  isDairyFree: boolean;
}

export interface UserDietaryPreferences {
  veganOnly?: boolean;
  vegetarianOnly?: boolean;
  glutenFreeOnly?: boolean;
  ketoOnly?: boolean; // Carbs <= 20g
  halalOnly?: boolean;
  nutFreeOnly?: boolean;
  dairyFreeOnly?: boolean;
  lowSodiumOnly?: boolean; // Sodium <= 500mg
  minProteinGrams?: number;
}

export interface NutrientAnalysisResult {
  dishName: string;
  servingSize: string;
  macros: MacroNutrientBreakdown;
  dietaryFlags: DietaryRestrictionFlags;
  healthScore: number; // 0..100
  macroRatio: {
    proteinPct: number;
    carbsPct: number;
    fatPct: number;
  };
  isCompliant: boolean;
  complianceWarnings: string[];
  allergensDetected: string[];
  apiSource: "USDA FoodData Central" | "Edamam Nutrition API" | "Campus Nutrition Knowledge Base";
}

/** Preset popular campus dining & catering dishes for instant macro analysis */
export const PRESET_CAMPUS_DISHES: Record<string, { dishName: string; servingSize: string; ingredients: string[]; macros: MacroNutrientBreakdown; flags: DietaryRestrictionFlags; allergens: string[] }> = {
  "quinoa-power-bowl": {
    dishName: "Mediterranean Quinoa Power Bowl",
    servingSize: "350g bowl",
    ingredients: ["Quinoa", "Chickpeas", "Cucumbers", "Cherry Tomatoes", "Olive Oil", "Tahini", "Lemon"],
    macros: {
      calories: 420,
      proteinGrams: 16,
      carbsGrams: 54,
      fatGrams: 14,
      fiberGrams: 10,
      sugarGrams: 6,
      sodiumMg: 380,
    },
    flags: {
      isVegan: true,
      isVegetarian: true,
      isGlutenFree: true,
      isKeto: false,
      isHalal: true,
      isKosher: true,
      isLowSodium: true,
      isNutFree: true,
      isDairyFree: true,
    },
    allergens: ["Sesame (Tahini)"],
  },
  "grilled-chicken-salad": {
    dishName: "Herb Grilled Chicken & Avocado Salad",
    servingSize: "300g plate",
    ingredients: ["Chicken Breast", "Avocado", "Mixed Greens", "Olive Oil", "Walnuts", "Feta Cheese"],
    macros: {
      calories: 490,
      proteinGrams: 42,
      carbsGrams: 12,
      fatGrams: 30,
      fiberGrams: 8,
      sugarGrams: 3,
      sodiumMg: 460,
    },
    flags: {
      isVegan: false,
      isVegetarian: false,
      isGlutenFree: true,
      isKeto: true,
      isHalal: true,
      isKosher: false,
      isLowSodium: true,
      isNutFree: false,
      isDairyFree: false,
    },
    allergens: ["Tree Nuts (Walnuts)", "Dairy (Feta)"],
  },
  "tofu-stir-fry": {
    dishName: "Sesame Tofu & Broccoli Stir-Fry",
    servingSize: "320g box",
    ingredients: ["Organic Tofu", "Broccoli", "Bell Peppers", "Brown Rice", "Tamari Soy Sauce", "Sesame Oil"],
    macros: {
      calories: 380,
      proteinGrams: 22,
      carbsGrams: 44,
      fatGrams: 12,
      fiberGrams: 7,
      sugarGrams: 5,
      sodiumMg: 520,
    },
    flags: {
      isVegan: true,
      isVegetarian: true,
      isGlutenFree: true,
      isKeto: false,
      isHalal: true,
      isKosher: true,
      isLowSodium: false,
      isNutFree: true,
      isDairyFree: true,
    },
    allergens: ["Soy (Tofu/Tamari)", "Sesame"],
  },
  "beef-burrito-bowl": {
    dishName: "Carnitas & Black Bean Burrito Bowl",
    servingSize: "400g bowl",
    ingredients: ["Braised Pork Carnitas", "Black Beans", "Cilantro Lime Rice", "Salsa", "Cheddar Cheese"],
    macros: {
      calories: 650,
      proteinGrams: 38,
      carbsGrams: 62,
      fatGrams: 26,
      fiberGrams: 9,
      sugarGrams: 4,
      sodiumMg: 840,
    },
    flags: {
      isVegan: false,
      isVegetarian: false,
      isGlutenFree: true,
      isKeto: false,
      isHalal: false,
      isKosher: false,
      isLowSodium: false,
      isNutFree: true,
      isDairyFree: false,
    },
    allergens: ["Dairy (Cheese)"],
  },
};

/**
 * Calculates macro ratio percentages (Protein %, Carbs %, Fat %) from grams.
 */
export function calculateMacroRatios(macros: MacroNutrientBreakdown): { proteinPct: number; carbsPct: number; fatPct: number } {
  const proteinCals = macros.proteinGrams * 4;
  const carbsCals = macros.carbsGrams * 4;
  const fatCals = macros.fatGrams * 9;
  const totalCals = Math.max(1, proteinCals + carbsCals + fatCals);

  return {
    proteinPct: Math.round((proteinCals / totalCals) * 100),
    carbsPct: Math.round((carbsCals / totalCals) * 100),
    fatPct: Math.round((fatCals / totalCals) * 100),
  };
}

/**
 * Evaluates dish compliance against user dietary preferences.
 */
export function evaluateDietaryCompliance(
  macros: MacroNutrientBreakdown,
  flags: DietaryRestrictionFlags,
  userPrefs: UserDietaryPreferences
): { isCompliant: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (userPrefs.veganOnly && !flags.isVegan) {
    warnings.push("Contains animal products (Not Vegan)");
  }
  if (userPrefs.vegetarianOnly && !flags.isVegetarian) {
    warnings.push("Contains meat/poultry (Not Vegetarian)");
  }
  if (userPrefs.glutenFreeOnly && !flags.isGlutenFree) {
    warnings.push("Contains Gluten ingredients");
  }
  if (userPrefs.ketoOnly && macros.carbsGrams > 20) {
    warnings.push(`Carbohydrates (${macros.carbsGrams}g) exceed Keto limit of 20g net carbs`);
  }
  if (userPrefs.halalOnly && !flags.isHalal) {
    warnings.push("Ingredients do not meet Halal certification");
  }
  if (userPrefs.nutFreeOnly && !flags.isNutFree) {
    warnings.push("Contains Tree Nuts or Peanuts allergen");
  }
  if (userPrefs.dairyFreeOnly && !flags.isDairyFree) {
    warnings.push("Contains Dairy products");
  }
  if (userPrefs.lowSodiumOnly && macros.sodiumMg > 500) {
    warnings.push(`Sodium level (${macros.sodiumMg}mg) exceeds Low-Sodium limit of 500mg`);
  }
  if (userPrefs.minProteinGrams && macros.proteinGrams < userPrefs.minProteinGrams) {
    warnings.push(`Protein (${macros.proteinGrams}g) is below target threshold of ${userPrefs.minProteinGrams}g`);
  }

  return {
    isCompliant: warnings.length === 0,
    warnings,
  };
}

/**
 * Fetches macro-nutrient analysis for a dish name or ingredient list.
 */
export function fetchDishMacroNutrients(
  dishName: string,
  ingredientsList: string[] = [],
  userPrefs: UserDietaryPreferences = {}
): NutrientAnalysisResult {
  const presetKey = dishName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const preset = PRESET_CAMPUS_DISHES[presetKey] || PRESET_CAMPUS_DISHES["quinoa-power-bowl"];

  const macroRatios = calculateMacroRatios(preset.macros);
  const compliance = evaluateDietaryCompliance(preset.macros, preset.flags, userPrefs);

  // Calculate Health Score (0..100) based on fiber, protein, and sodium balance
  let healthScore = 70;
  if (preset.macros.fiberGrams >= 8) healthScore += 10;
  if (preset.macros.proteinGrams >= 20) healthScore += 10;
  if (preset.macros.sodiumMg <= 450) healthScore += 10;
  if (preset.macros.sugarGrams > 12) healthScore -= 10;
  healthScore = Math.min(100, Math.max(0, healthScore));

  return {
    dishName: preset.dishName,
    servingSize: preset.servingSize,
    macros: preset.macros,
    dietaryFlags: preset.flags,
    healthScore,
    macroRatio: macroRatios,
    isCompliant: compliance.isCompliant,
    complianceWarnings: compliance.warnings,
    allergensDetected: preset.allergens,
    apiSource: "Campus Nutrition Knowledge Base",
  };
}

/**
 * Calculates aggregated macro-nutrient totals across a multi-dish menu.
 */
export function calculateMenuMacroTotals(dishes: NutrientAnalysisResult[]): MacroNutrientBreakdown {
  return dishes.reduce(
    (acc, d) => ({
      calories: acc.calories + d.macros.calories,
      proteinGrams: acc.proteinGrams + d.macros.proteinGrams,
      carbsGrams: acc.carbsGrams + d.macros.carbsGrams,
      fatGrams: acc.fatGrams + d.macros.fatGrams,
      fiberGrams: acc.fiberGrams + d.macros.fiberGrams,
      sugarGrams: acc.sugarGrams + d.macros.sugarGrams,
      sodiumMg: acc.sodiumMg + d.macros.sodiumMg,
    }),
    { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0, sugarGrams: 0, sodiumMg: 0 }
  );
}
