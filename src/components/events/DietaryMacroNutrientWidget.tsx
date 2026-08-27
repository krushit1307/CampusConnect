// =============================================================================
// File: src/components/events/DietaryMacroNutrientWidget.tsx
// Task: Interactive "Dietary Restriction" Macro-Nutrient API Integration
// Description: Interactive neubrutalist UI widget for analyzing food macros,
//              toggling user dietary restriction profiles (Keto, Vegan, Halal, Nut-Free, etc.),
//              and viewing live compliance verdicts and allergen warnings.
// =============================================================================

import React, { useState } from "react";
import Utensils from "lucide-react/dist/esm/icons/utensils";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import Flame from "lucide-react/dist/esm/icons/flame";
import HeartPulse from "lucide-react/dist/esm/icons/heart-pulse";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Search from "lucide-react/dist/esm/icons/search";
import Filter from "lucide-react/dist/esm/icons/filter";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";

import {
  PRESET_CAMPUS_DISHES,
  fetchDishMacroNutrients,
  type UserDietaryPreferences,
  type NutrientAnalysisResult,
} from "@/services/dietaryMacroNutrientService";

export interface DietaryMacroNutrientWidgetProps {
  initialDishName?: string;
}

export const DietaryMacroNutrientWidget: React.FC<DietaryMacroNutrientWidgetProps> = ({
  initialDishName = "quinoa-power-bowl",
}) => {
  const [selectedDishKey, setSelectedDishKey] = useState<string>(initialDishName);
  const [customDishSearch, setCustomDishSearch] = useState<string>("");
  const [userPrefs, setUserPrefs] = useState<UserDietaryPreferences>({
    veganOnly: false,
    glutenFreeOnly: true,
    ketoOnly: false,
    halalOnly: false,
    nutFreeOnly: true,
    dairyFreeOnly: false,
    lowSodiumOnly: false,
  });

  const activeDishKey = customDishSearch ? customDishSearch : selectedDishKey;
  const analysis: NutrientAnalysisResult = fetchDishMacroNutrients(activeDishKey, [], userPrefs);

  const togglePref = (key: keyof UserDietaryPreferences) => {
    setUserPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div
      className="neu-border border-4 border-black bg-lime-50 p-6 shadow-[6px_6px_0_0_#000] space-y-6 dark:bg-zinc-900 dark:border-lime-500"
      data-testid="dietary-macro-nutrient-widget"
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-4 border-black pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="border-2 border-black bg-lime-300 text-black font-mono text-[10px] font-bold uppercase px-2.5 py-0.5 shadow-[1px_1px_0_0_#000]">
              Macro-Nutrient API Integration
            </span>
            <span className="border-2 border-black bg-emerald-300 text-emerald-950 font-mono text-[10px] font-bold uppercase px-2 py-0.5">
              Live Nutritional Analysis
            </span>
          </div>
          <h2 className="font-display text-2xl font-black uppercase text-black dark:text-white flex items-center gap-2">
            <Utensils className="h-6 w-6 text-lime-700" />
            Dietary Restriction & Macro-Nutrient Analyzer
          </h2>
          <p className="font-mono text-xs text-gray-700 dark:text-gray-300">
            Source: <strong className="text-black dark:text-white">{analysis.apiSource}</strong> • Instant WCAG & Restriction Compliance
          </p>
        </div>

        {/* Health Score Badge */}
        <div className="border-2 border-black bg-lime-300 px-4 py-2 font-mono text-center shadow-[2px_2px_0_0_#000] shrink-0">
          <span className="text-[10px] font-bold uppercase text-lime-950 block">Health Score</span>
          <span
            className="font-display text-2xl font-black text-lime-950 flex items-center justify-center gap-1"
            data-testid="health-score-value"
          >
            <HeartPulse className="h-5 w-5 text-rose-600" /> {analysis.healthScore}
            <span className="text-xs font-normal">/100</span>
          </span>
        </div>
      </div>

      {/* Preset Dish Selector & Search */}
      <div className="space-y-3">
        <label className="font-mono text-xs font-black uppercase text-black dark:text-white flex items-center gap-1.5">
          <Search className="h-4 w-4 text-lime-700" />
          Select Event Catering Item or Search Dish:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.keys(PRESET_CAMPUS_DISHES).map((key) => {
            const item = PRESET_CAMPUS_DISHES[key];
            const isSelected = selectedDishKey === key && !customDishSearch;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedDishKey(key);
                  setCustomDishSearch("");
                }}
                className={`border-2 border-black p-3 text-left font-mono text-xs shadow-[2px_2px_0_0_#000] transition-all cursor-pointer ${
                  isSelected
                    ? "bg-lime-400 text-black font-black translate-y-[1px]"
                    : "bg-white hover:bg-lime-100 text-black dark:bg-zinc-800 dark:text-white"
                }`}
                data-testid={`preset-dish-btn-${key}`}
              >
                <span className="block font-bold text-[11px] truncate">{item.dishName}</span>
                <span className="text-[10px] opacity-80 block truncate">{item.macros.calories} kcal</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive User Dietary Restriction Preferences Toggles */}
      <div className="border-2 border-black bg-white p-4 space-y-3 shadow-[4px_4px_0_0_#000] dark:bg-zinc-800">
        <label className="font-mono text-xs font-black uppercase text-black dark:text-white flex items-center gap-1.5 border-b-2 border-black pb-2">
          <Filter className="h-4 w-4 text-purple-700" />
          Toggle Your Dietary Restrictions & Preferences:
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "veganOnly", label: "Vegan" },
            { key: "glutenFreeOnly", label: "Gluten-Free" },
            { key: "ketoOnly", label: "Keto (≤20g Carbs)" },
            { key: "halalOnly", label: "Halal" },
            { key: "nutFreeOnly", label: "Nut-Free" },
            { key: "dairyFreeOnly", label: "Dairy-Free" },
            { key: "lowSodiumOnly", label: "Low Sodium (≤500mg)" },
          ].map(({ key, label }) => {
            const isActive = !!userPrefs[key as keyof UserDietaryPreferences];
            return (
              <button
                key={key}
                type="button"
                onClick={() => togglePref(key as keyof UserDietaryPreferences)}
                className={`border-2 border-black font-mono text-xs font-bold uppercase px-3 py-1.5 shadow-[2px_2px_0_0_#000] cursor-pointer transition-all ${
                  isActive
                    ? "bg-purple-600 text-white translate-y-[1px]"
                    : "bg-gray-100 text-black hover:bg-purple-100 dark:bg-zinc-700 dark:text-white"
                }`}
                data-testid={`toggle-pref-${key}`}
              >
                {isActive ? "✓ " : "+ "}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Compliance Verdict Banner */}
      <div
        className={`neu-border border-4 border-black p-4 shadow-[4px_4px_0_0_#000] space-y-2 ${
          analysis.isCompliant ? "bg-emerald-100 dark:bg-emerald-950" : "bg-rose-100 dark:bg-rose-950"
        }`}
        data-testid="compliance-verdict-banner"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-sm font-black uppercase text-black dark:text-white">
            {analysis.isCompliant ? (
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-6 w-6 text-rose-600" />
            )}
            <span>
              Compliance Verdict:{" "}
              <strong
                className={analysis.isCompliant ? "text-emerald-800 dark:text-emerald-300" : "text-rose-800 dark:text-rose-300"}
              >
                {analysis.isCompliant ? "COMPLIANT WITH YOUR DIET 🎉" : "DIETARY RESTRICTION WARNING ⚠️"}
              </strong>
            </span>
          </div>
          <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 border border-black bg-white text-black shadow-[1px_1px_0_0_#000]">
            {analysis.dishName}
          </span>
        </div>

        {!analysis.isCompliant && analysis.complianceWarnings.length > 0 && (
          <div className="space-y-1 pt-1 font-mono text-xs text-rose-950 dark:text-rose-200">
            {analysis.complianceWarnings.map((warning, idx) => (
              <div key={idx} className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4 text-rose-700 flex-shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Macro-Nutrient Breakdown Cards */}
      <div className="space-y-3">
        <h3 className="font-display text-base font-black uppercase text-black dark:text-white flex items-center gap-2">
          <Flame className="h-5 w-5 text-amber-600" />
          Macro-Nutrient Breakdown & Caloric Density ({analysis.servingSize})
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border-2 border-black bg-amber-100 p-3 font-mono shadow-[2px_2px_0_0_#000]">
            <span className="text-[10px] font-bold uppercase text-amber-900 block">Total Calories</span>
            <span className="font-display text-xl font-black text-amber-950 flex items-center gap-1">
              <Flame className="h-4 w-4 fill-amber-950" /> {analysis.macros.calories}
              <span className="text-xs font-normal">kcal</span>
            </span>
          </div>

          <div className="border-2 border-black bg-blue-100 p-3 font-mono shadow-[2px_2px_0_0_#000]">
            <span className="text-[10px] font-bold uppercase text-blue-900 block">Protein</span>
            <span className="font-display text-xl font-black text-blue-950">
              {analysis.macros.proteinGrams}g
            </span>
            <span className="text-[10px] text-blue-800 block">Ratio: {analysis.macroRatio.proteinPct}%</span>
          </div>

          <div className="border-2 border-black bg-emerald-100 p-3 font-mono shadow-[2px_2px_0_0_#000]">
            <span className="text-[10px] font-bold uppercase text-emerald-900 block">Carbohydrates</span>
            <span className="font-display text-xl font-black text-emerald-950">
              {analysis.macros.carbsGrams}g
            </span>
            <span className="text-[10px] text-emerald-800 block">Ratio: {analysis.macroRatio.carbsPct}%</span>
          </div>

          <div className="border-2 border-black bg-purple-100 p-3 font-mono shadow-[2px_2px_0_0_#000]">
            <span className="text-[10px] font-bold uppercase text-purple-900 block">Total Fats</span>
            <span className="font-display text-xl font-black text-purple-950">
              {analysis.macros.fatGrams}g
            </span>
            <span className="text-[10px] text-purple-800 block">Ratio: {analysis.macroRatio.fatPct}%</span>
          </div>
        </div>

        {/* Micro & Fiber Breakdown Table */}
        <div className="border-2 border-black bg-white p-3 font-mono text-xs grid grid-cols-3 gap-2 shadow-[2px_2px_0_0_#000] dark:bg-zinc-800">
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Dietary Fiber</span>
            <span className="font-bold text-black dark:text-white">{analysis.macros.fiberGrams}g</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Sugars</span>
            <span className="font-bold text-black dark:text-white">{analysis.macros.sugarGrams}g</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Sodium Content</span>
            <span className="font-bold text-black dark:text-white">{analysis.macros.sodiumMg}mg</span>
          </div>
        </div>
      </div>
    </div>
  );
};
