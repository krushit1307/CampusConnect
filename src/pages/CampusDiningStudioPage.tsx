import React, { useState } from 'react';
import {
  CampusDiningService,
  DiningHallVenue,
  StudentMealPassToken,
  DietaryGoalTracker,
} from '../../backend/src/services/CampusDiningService';

export const CampusDiningStudioPage: React.FC = () => {
  const [venues] = useState<DiningHallVenue[]>(
    CampusDiningService.getVenues()
  );
  const [pass, setPass] = useState<StudentMealPassToken>(
    CampusDiningService.getStudentPass('STU-999')
  );
  const [nutrition, setNutrition] = useState<DietaryGoalTracker>(
    CampusDiningService.getNutritionGoals('STU-999')
  );

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  const metrics = CampusDiningService.getDiningMetrics();

  const handleRedeemSwipe = (hallId: string) => {
    try {
      const updatedPass = CampusDiningService.redeemSwipe('STU-999', hallId);
      const updatedNutrition = CampusDiningService.getNutritionGoals('STU-999');
      setPass({ ...updatedPass });
      setNutrition({ ...updatedNutrition });
      setRedeemSuccess(`Successfully redeemed meal swipe at ${hallId}! Calories & macros logged.`);
      setTimeout(() => setRedeemSuccess(null), 3500);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddWater = () => {
    const updated = CampusDiningService.logWaterIntake('STU-999', 0.5);
    setNutrition({ ...updated });
  };

  const filteredVenues = venues.filter((v) => {
    if (selectedCategoryFilter === 'ALL') return true;
    if (selectedCategoryFilter === 'VEGAN') return v.todaysSpecial.toLowerCase().includes('tofu') || v.todaysSpecial.toLowerCase().includes('avocado');
    if (selectedCategoryFilter === 'KETO') return v.todaysSpecial.toLowerCase().includes('salmon') || v.todaysSpecial.toLowerCase().includes('steak');
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Smart Dining & AI Nutrition Studio
            </span>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-3 py-1 rounded-full font-mono">
              Live Sensor Crowd Telemetry Operational
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Campus Smart Dining Hall & AI Nutrition Hub
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Monitor dining hall capacity in real time, redeem digital meal passes, track macro-nutrition goals, and filter allergen dietary preferences.
          </p>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Meal Swipes Balance</span>
          <div className="text-2xl md:text-3xl font-black text-orange-400 mt-1">
            {pass.remainingMealSwipes} Swipes
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Tier: {pass.activeMealPlanTier} ({pass.totalSwipesRedeemed} Used)</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dining Dollars Credit</span>
          <div className="text-2xl md:text-3xl font-black text-emerald-400 mt-1">
            ${pass.diningDollarBalanceUsd.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Campus Retail & Bakery Access</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Dining Wait Time</span>
          <div className="text-2xl md:text-3xl font-black text-amber-400 mt-1">
            {metrics.avgWaitMinutes} Mins
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Avg Occupancy: {metrics.avgCrowdPct}%</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dietary Filter Active</span>
          <div className="text-xl md:text-2xl font-black text-sky-400 mt-1">
            {pass.dietaryPreferenceFilter}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Allergen Safety Verified</span>
        </div>
      </div>

      {redeemSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-xs font-bold shadow-lg">
          ✅ {redeemSuccess}
        </div>
      )}

      {/* AI Macro-Nutrition & Hydration Tracker */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-black text-white">Daily AI Macro-Nutrition & Hydration Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Calorie Intake */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-400">Calorie Progress</span>
              <span className="text-orange-400">{nutrition.consumedCaloriesToday} / {nutrition.dailyCalorieGoal} kcal</span>
            </div>
            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.round((nutrition.consumedCaloriesToday / nutrition.dailyCalorieGoal) * 100))}%` }}
              ></div>
            </div>
          </div>

          {/* Protein Intake */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-400">Protein Intake</span>
              <span className="text-purple-400">{nutrition.consumedProteinTodayGrams} / {nutrition.dailyProteinGoalGrams} g</span>
            </div>
            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.round((nutrition.consumedProteinTodayGrams / nutrition.dailyProteinGoalGrams) * 100))}%` }}
              ></div>
            </div>
          </div>

          {/* Hydration */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 block">Hydration Target</span>
              <span className="text-xl font-black text-sky-400">{nutrition.waterIntakeLitersToday} Liters</span>
            </div>
            <button
              onClick={handleAddWater}
              className="py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition-all"
            >
              +0.5L Water 💧
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300">Filter Menu by Diet:</span>
        <div className="flex gap-2">
          {['ALL', 'VEGAN', 'KETO'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedCategoryFilter === cat
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Dining Halls Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredVenues.map((v) => (
          <div
            key={v.hallId}
            className="bg-slate-900/80 backdrop-blur-md border border-slate-800 hover:border-orange-500/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-all space-y-4"
          >
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 border border-orange-500/30 px-3 py-1 rounded-full">
                  {v.status}
                </span>
                <span className="text-xs font-bold text-slate-400">🕒 {v.currentWaitTimeMinutes} Min Queue Wait</span>
              </div>

              <h3 className="text-xl font-black text-white">{v.name}</h3>
              <p className="text-xs text-slate-400 mb-3">📍 {v.locationArea}</p>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <span className="text-orange-400 font-bold block">Today's Chef Special</span>
                <p className="text-white font-bold">{v.todaysSpecial}</p>
                <div className="flex justify-between text-slate-400 text-[11px] pt-2 border-t border-slate-900">
                  <span>Macros: {v.proteinGrams}g Protein • {v.carbsGrams}g Carbs • {v.fatGrams}g Fat</span>
                  <span className="font-bold text-amber-400">{v.calorieCountApprox} kcal</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleRedeemSwipe(v.hallId)}
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-all shadow-lg hover:shadow-orange-500/20"
            >
              Redeem Digital Meal Swipe 🍽️
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
