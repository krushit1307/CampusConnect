import { useState, useMemo, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MealType = "breakfast" | "lunch" | "dinner" | "late-night";
export type DiningHall = "commons" | "quad" | "north-end" | "south-end" | "central";
export type MealPlanTier = "basic" | "standard" | "premium" | "unlimited";
export type NutrientCategory = "protein" | "carbs" | "fat" | "fiber" | "vitamins";

export interface DiningHallInfo {
  id: DiningHall;
  name: string;
  zone: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  rating: number;
  totalRatings: number;
  currentWait: number; // minutes
  todayMenu: string[];
  cuisine: string[];
  icon: string;
  color: string;
  bg: string;
  border: string;
}

export interface MealSwipe {
  id: string;
  userId: string;
  diningHallId: DiningHall;
  mealType: MealType;
  date: string;
  time: string;
  items: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  cost: number; // estimated value
}

export interface MealPlan {
  id: string;
  tier: MealPlanTier;
  swipesRemaining: number;
  swipesTotal: number;
  guestPassesRemaining: number;
  guestPassesTotal: number;
  diningDollars: number;
  diningDollarsTotal: number;
  semesterStart: string;
  semesterEnd: string;
  autoRenew: boolean;
}

export interface FavoriteItem {
  id: string;
  name: string;
  diningHallId: DiningHall;
  calories: number;
  lastOrdered: string;
  orderCount: number;
}

export interface NutrientLog {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface MealPlanStats {
  totalSwipes: number;
  avgCaloriesPerDay: number;
  totalCalories: number;
  avgProteinPerDay: number;
  mostVisitedHall: string;
  favoriteMealType: MealType;
  swipesPerWeek: number;
  daysRemaining: number;
  percentUsed: number;
  diningDollarsSpent: number;
  avgCostPerSwipe: number;
  weeklyCalorieTrend: number[];
  streakDays: number;
  topNutrientDay: string;
}

export type MealPlanSortOption = "date" | "calories" | "hall" | "cost";
export type MealPlanViewMode = "overview" | "history" | "nutrition" | "halls";

export interface UseMealPlanReturn {
  halls: DiningHallInfo[];
  swipes: MealSwipe[];
  plan: MealPlan;
  favorites: FavoriteItem[];
  nutrientLogs: NutrientLog[];
  stats: MealPlanStats;
  selectedHallId: string | null;
  setSelectedHallId: (id: string | null) => void;
  mealTypeFilter: MealType | "all";
  setMealTypeFilter: (f: MealType | "all") => void;
  hallFilter: DiningHall | "all";
  setHallFilter: (f: DiningHall | "all") => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortBy: MealPlanSortOption;
  setSortBy: (s: MealPlanSortOption) => void;
  viewMode: MealPlanViewMode;
  setViewMode: (v: MealPlanViewMode) => void;
  logSwipe: (swipe: Omit<MealSwipe, "id">) => void;
  removeSwipe: (id: string) => void;
  addFavorite: (item: Omit<FavoriteItem, "id">) => void;
  removeFavorite: (id: string) => void;
  rateHall: (hallId: DiningHall, rating: number) => void;
  getHallById: (id: DiningHall) => DiningHallInfo | undefined;
  getSwipesByHall: (hallId: DiningHall) => MealSwipe[];
  getSwipesByDate: (date: string) => MealSwipe[];
  getCalorieTrend: () => { date: string; calories: number }[];
  getNutrientBreakdown: () => { label: string; value: number; color: string; percentage: number }[];
  getRecommendations: () => DiningHallInfo[];
  getMealPlanProjection: () => { week: number; projected: number; target: number }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MEAL_TYPES: Record<
  MealType,
  { label: string; icon: string; timeRange: string; color: string; bg: string; border: string }
> = {
  breakfast: {
    label: "Breakfast",
    icon: "🍳",
    timeRange: "7:00–10:00",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  lunch: {
    label: "Lunch",
    icon: "🥗",
    timeRange: "11:00–14:00",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  dinner: {
    label: "Dinner",
    icon: "🍽️",
    timeRange: "17:00–20:00",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  "late-night": {
    label: "Late Night",
    icon: "🌙",
    timeRange: "20:00–23:00",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
  },
};

const PLAN_TIERS: Record<
  MealPlanTier,
  { label: string; swipes: number; guestPasses: number; dollars: number; color: string }
> = {
  basic: { label: "Basic", swipes: 100, guestPasses: 2, dollars: 100, color: "text-slate-400" },
  standard: {
    label: "Standard",
    swipes: 175,
    guestPasses: 5,
    dollars: 200,
    color: "text-blue-400",
  },
  premium: {
    label: "Premium",
    swipes: 250,
    guestPasses: 10,
    dollars: 350,
    color: "text-amber-400",
  },
  unlimited: {
    label: "Unlimited",
    swipes: 999,
    guestPasses: 15,
    dollars: 500,
    color: "text-purple-400",
  },
};

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_HALLS: DiningHallInfo[] = [
  {
    id: "commons",
    name: "Main Commons",
    zone: "Central",
    isOpen: true,
    openTime: "7:00",
    closeTime: "22:00",
    rating: 4.3,
    totalRatings: 156,
    currentWait: 8,
    todayMenu: ["Grilled Chicken", "Pasta Bar", "Caesar Salad", "Soup of the Day", "Fruit Station"],
    cuisine: ["American", "Italian", "Salad Bar"],
    icon: "🍽️",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  {
    id: "quad",
    name: "Quad Dining Hall",
    zone: "North",
    isOpen: true,
    openTime: "7:00",
    closeTime: "21:00",
    rating: 4.6,
    totalRatings: 203,
    currentWait: 5,
    todayMenu: ["Sushi Station", "Pho Bar", "Vegan Bowl", "Pizza", "Dessert Bar"],
    cuisine: ["Asian", "Vegan", "Italian"],
    icon: "🏯",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  {
    id: "north-end",
    name: "North End Eatery",
    zone: "North",
    isOpen: false,
    openTime: "11:00",
    closeTime: "20:00",
    rating: 3.9,
    totalRatings: 89,
    currentWait: 0,
    todayMenu: ["Burgers", "Fries", "Milkshakes", "Grilled Cheese"],
    cuisine: ["American", "Fast Food"],
    icon: "🍔",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  {
    id: "south-end",
    name: "South End Kitchen",
    zone: "South",
    isOpen: true,
    openTime: "7:00",
    closeTime: "23:00",
    rating: 4.1,
    totalRatings: 134,
    currentWait: 12,
    todayMenu: ["Taco Bar", "Burrito Bowl", "Quesadillas", "Churros", "Agua Fresca"],
    cuisine: ["Mexican", "Latin"],
    icon: "🌮",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
  },
  {
    id: "central",
    name: "Central Market",
    zone: "Central",
    isOpen: true,
    openTime: "8:00",
    closeTime: "23:00",
    rating: 4.7,
    totalRatings: 245,
    currentWait: 3,
    todayMenu: ["Mediterranean Bowl", "Falafel Wrap", "Hummus Plate", "Shawarma", "Baklava"],
    cuisine: ["Mediterranean", "Middle Eastern"],
    icon: "🧆",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
  },
];

const MOCK_SWIPES: MealSwipe[] = [
  {
    id: "sw-1",
    userId: "u-self",
    diningHallId: "commons",
    mealType: "breakfast",
    date: "2026-08-28",
    time: "08:15",
    items: ["Scrambled Eggs", "Toast", "Orange Juice", "Fruit"],
    calories: 520,
    protein: 22,
    carbs: 65,
    fat: 18,
    cost: 8.5,
  },
  {
    id: "sw-2",
    userId: "u-self",
    diningHallId: "quad",
    mealType: "lunch",
    date: "2026-08-28",
    time: "12:30",
    items: ["Sushi Roll", "Edamame", "Miso Soup"],
    calories: 680,
    protein: 32,
    carbs: 78,
    fat: 24,
    cost: 11.0,
  },
  {
    id: "sw-3",
    userId: "u-self",
    diningHallId: "central",
    mealType: "dinner",
    date: "2026-08-27",
    time: "18:45",
    items: ["Falafel Wrap", "Hummus", "Pita", " baklava"],
    calories: 750,
    protein: 28,
    carbs: 88,
    fat: 30,
    cost: 12.5,
  },
  {
    id: "sw-4",
    userId: "u-self",
    diningHallId: "south-end",
    mealType: "lunch",
    date: "2026-08-27",
    time: "12:00",
    items: ["Burrito Bowl", "Chips & Salsa"],
    calories: 820,
    protein: 35,
    carbs: 95,
    fat: 28,
    cost: 10.5,
  },
  {
    id: "sw-5",
    userId: "u-self",
    diningHallId: "commons",
    mealType: "breakfast",
    date: "2026-08-27",
    time: "07:45",
    items: ["Pancakes", "Bacon", "Coffee"],
    calories: 650,
    protein: 18,
    carbs: 72,
    fat: 32,
    cost: 9.0,
  },
  {
    id: "sw-6",
    userId: "u-self",
    diningHallId: "quad",
    mealType: "dinner",
    date: "2026-08-26",
    time: "19:00",
    items: ["Pho", "Spring Rolls", "Green Tea"],
    calories: 580,
    protein: 26,
    carbs: 68,
    fat: 16,
    cost: 10.0,
  },
  {
    id: "sw-7",
    userId: "u-self",
    diningHallId: "central",
    mealType: "lunch",
    date: "2026-08-26",
    time: "12:15",
    items: ["Mediterranean Bowl", "Feta", "Olives"],
    calories: 710,
    protein: 30,
    carbs: 75,
    fat: 28,
    cost: 11.5,
  },
  {
    id: "sw-8",
    userId: "u-self",
    diningHallId: "commons",
    mealType: "dinner",
    date: "2026-08-25",
    time: "18:30",
    items: ["Grilled Chicken", "Rice", "Vegetables"],
    calories: 620,
    protein: 40,
    carbs: 58,
    fat: 20,
    cost: 10.0,
  },
  {
    id: "sw-9",
    userId: "u-self",
    diningHallId: "south-end",
    mealType: "late-night",
    date: "2026-08-25",
    time: "21:30",
    items: ["Nachos", "Soda"],
    calories: 880,
    protein: 15,
    carbs: 105,
    fat: 42,
    cost: 7.5,
  },
  {
    id: "sw-10",
    userId: "u-self",
    diningHallId: "quad",
    mealType: "breakfast",
    date: "2026-08-25",
    time: "08:00",
    items: ["Oatmeal", "Berries", "Yogurt"],
    calories: 420,
    protein: 15,
    carbs: 58,
    fat: 10,
    cost: 7.0,
  },
  {
    id: "sw-11",
    userId: "u-self",
    diningHallId: "commons",
    mealType: "lunch",
    date: "2026-08-24",
    time: "12:00",
    items: ["Pasta", "Garlic Bread", "Salad"],
    calories: 780,
    protein: 22,
    carbs: 100,
    fat: 28,
    cost: 9.5,
  },
  {
    id: "sw-12",
    userId: "u-self",
    diningHallId: "central",
    mealType: "dinner",
    date: "2026-08-24",
    time: "18:15",
    items: ["Shawarma Plate", "Rice", "Tabbouleh"],
    calories: 720,
    protein: 34,
    carbs: 80,
    fat: 26,
    cost: 12.0,
  },
  {
    id: "sw-13",
    userId: "u-self",
    diningHallId: "quad",
    mealType: "lunch",
    date: "2026-08-23",
    time: "12:45",
    items: ["Vegan Bowl", "Tofu", "Avocado"],
    calories: 550,
    protein: 20,
    carbs: 62,
    fat: 22,
    cost: 11.0,
  },
  {
    id: "sw-14",
    userId: "u-self",
    diningHallId: "south-end",
    mealType: "dinner",
    date: "2026-08-23",
    time: "19:00",
    items: ["Tacos", "Rice", " Beans"],
    calories: 690,
    protein: 28,
    carbs: 82,
    fat: 24,
    cost: 10.0,
  },
  {
    id: "sw-15",
    userId: "u-self",
    diningHallId: "commons",
    mealType: "breakfast",
    date: "2026-08-22",
    time: "08:30",
    items: ["Waffles", "Syrup", "Milk"],
    calories: 580,
    protein: 14,
    carbs: 78,
    fat: 22,
    cost: 8.0,
  },
];

const MOCK_PLAN: MealPlan = {
  id: "mp-1",
  tier: "standard",
  swipesRemaining: 112,
  swipesTotal: 175,
  guestPassesRemaining: 3,
  guestPassesTotal: 5,
  diningDollars: 142.5,
  diningDollarsTotal: 200,
  semesterStart: "2026-08-20",
  semesterEnd: "2026-12-15",
  autoRenew: true,
};

const MOCK_FAVORITES: FavoriteItem[] = [
  {
    id: "fav-1",
    name: "Falafel Wrap",
    diningHallId: "central",
    calories: 520,
    lastOrdered: "2026-08-27",
    orderCount: 8,
  },
  {
    id: "fav-2",
    name: "Sushi Roll Combo",
    diningHallId: "quad",
    calories: 480,
    lastOrdered: "2026-08-28",
    orderCount: 12,
  },
  {
    id: "fav-3",
    name: "Pho",
    diningHallId: "quad",
    calories: 380,
    lastOrdered: "2026-08-26",
    orderCount: 6,
  },
  {
    id: "fav-4",
    name: "Grilled Chicken Plate",
    diningHallId: "commons",
    calories: 450,
    lastOrdered: "2026-08-25",
    orderCount: 5,
  },
  {
    id: "fav-5",
    name: "Burrito Bowl",
    diningHallId: "south-end",
    calories: 620,
    lastOrdered: "2026-08-27",
    orderCount: 9,
  },
];

const MOCK_NUTRIENT_LOGS: NutrientLog[] = [
  { date: "2026-08-28", calories: 1200, protein: 54, carbs: 143, fat: 42, fiber: 12 },
  { date: "2026-08-27", calories: 2250, protein: 81, carbs: 255, fat: 80, fiber: 18 },
  { date: "2026-08-26", calories: 1290, protein: 56, carbs: 143, fat: 44, fiber: 14 },
  { date: "2026-08-25", calories: 1920, protein: 53, carbs: 233, fat: 72, fiber: 10 },
  { date: "2026-08-24", calories: 1500, protein: 56, carbs: 180, fat: 54, fiber: 16 },
  { date: "2026-08-23", calories: 1240, protein: 48, carbs: 144, fat: 46, fiber: 11 },
  { date: "2026-08-22", calories: 580, protein: 14, carbs: 78, fat: 22, fiber: 4 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeStreak(logs: MealSwipe[]): number {
  const dates = new Set(logs.map((l) => l.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    if (dates.has(key)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useMealPlan(): UseMealPlanReturn {
  const [halls] = useState<DiningHallInfo[]>(MOCK_HALLS);
  const [swipes, setSwipes] = useState<MealSwipe[]>(MOCK_SWIPES);
  const [plan] = useState<MealPlan>(MOCK_PLAN);
  const [favorites, setFavorites] = useState<FavoriteItem[]>(MOCK_FAVORITES);
  const [nutrientLogs] = useState<NutrientLog[]>(MOCK_NUTRIENT_LOGS);
  const [selectedHallId, setSelectedHallId] = useState<string | null>(null);
  const [mealTypeFilter, setMealTypeFilter] = useState<MealType | "all">("all");
  const [hallFilter, setHallFilter] = useState<DiningHall | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<MealPlanSortOption>("date");
  const [viewMode, setViewMode] = useState<MealPlanViewMode>("overview");

  const logSwipe = useCallback((swipe: Omit<MealSwipe, "id">) => {
    setSwipes((prev) => [{ ...swipe, id: `sw-${Date.now()}` }, ...prev]);
  }, []);

  const removeSwipe = useCallback((id: string) => {
    setSwipes((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const addFavorite = useCallback((item: Omit<FavoriteItem, "id">) => {
    setFavorites((prev) => [...prev, { ...item, id: `fav-${Date.now()}` }]);
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const rateHall = useCallback((hallId: DiningHall, rating: number) => {
    // rates in halls state are mock, this is a no-op for demo
  }, []);

  const getHallById = useCallback((id: DiningHall) => halls.find((h) => h.id === id), [halls]);

  const getSwipesByHall = useCallback(
    (hallId: DiningHall) => swipes.filter((s) => s.diningHallId === hallId),
    [swipes],
  );

  const getSwipesByDate = useCallback(
    (date: string) => swipes.filter((s) => s.date === date),
    [swipes],
  );

  const stats = useMemo<MealPlanStats>(() => {
    const totalSwipes = swipes.length;
    const totalCalories = swipes.reduce((s, sw) => s + sw.calories, 0);
    const uniqueDates = new Set(swipes.map((s) => s.date)).size || 1;
    const avgCaloriesPerDay = Math.round(totalCalories / uniqueDates);
    const totalProtein = swipes.reduce((s, sw) => s + sw.protein, 0);
    const avgProteinPerDay = Math.round(totalProtein / uniqueDates);

    const hallCounts: Record<string, number> = {};
    swipes.forEach((s) => {
      hallCounts[s.diningHallId] = (hallCounts[s.diningHallId] || 0) + 1;
    });
    const mostVisitedId = Object.entries(hallCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "";
    const mostVisitedHall = halls.find((h) => h.id === mostVisitedId)?.name || "N/A";

    const mealCounts: Record<MealType, number> = {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      "late-night": 0,
    };
    swipes.forEach((s) => {
      mealCounts[s.mealType]++;
    });
    const favoriteMealType = (Object.entries(mealCounts) as [MealType, number][]).sort(
      ([, a], [, b]) => b - a,
    )[0][0];

    const totalCost = swipes.reduce((s, sw) => s + sw.cost, 0);
    const semStart = new Date(plan.semesterStart);
    const semEnd = new Date(plan.semesterEnd);
    const totalDays = Math.max(1, Math.ceil((semEnd.getTime() - semStart.getTime()) / 86400000));
    const daysPassed = Math.min(totalDays, Math.ceil((Date.now() - semStart.getTime()) / 86400000));
    const daysRemaining = Math.max(0, totalDays - daysPassed);

    return {
      totalSwipes,
      avgCaloriesPerDay,
      totalCalories,
      avgProteinPerDay,
      mostVisitedHall,
      favoriteMealType,
      swipesPerWeek: Math.round((totalSwipes / Math.max(uniqueDates, 1)) * 7),
      daysRemaining,
      percentUsed: Math.round(((plan.swipesTotal - plan.swipesRemaining) / plan.swipesTotal) * 100),
      diningDollarsSpent: plan.diningDollarsTotal - plan.diningDollars,
      avgCostPerSwipe: totalSwipes > 0 ? Math.round((totalCost / totalSwipes) * 100) / 100 : 0,
      weeklyCalorieTrend: nutrientLogs.slice(0, 7).map((l) => l.calories),
      streakDays: computeStreak(swipes),
      topNutrientDay: nutrientLogs.sort((a, b) => b.calories - a.calories)[0]?.date || "",
    };
  }, [swipes, halls, plan, nutrientLogs]);

  const getCalorieTrend = useCallback(() => {
    return nutrientLogs
      .map((l) => ({ date: l.date, calories: l.calories }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [nutrientLogs]);

  const getNutrientBreakdown = useCallback(() => {
    const latest = nutrientLogs[0];
    if (!latest) return [];
    const total = latest.protein * 4 + latest.carbs * 4 + latest.fat * 9;
    return [
      {
        label: "Protein",
        value: latest.protein,
        color: "text-blue-400",
        percentage: total > 0 ? Math.round(((latest.protein * 4) / total) * 100) : 0,
      },
      {
        label: "Carbs",
        value: latest.carbs,
        color: "text-emerald-400",
        percentage: total > 0 ? Math.round(((latest.carbs * 4) / total) * 100) : 0,
      },
      {
        label: "Fat",
        value: latest.fat,
        color: "text-amber-400",
        percentage: total > 0 ? Math.round(((latest.fat * 9) / total) * 100) : 0,
      },
    ];
  }, [nutrientLogs]);

  const getRecommendations = useCallback(() => {
    return [...halls]
      .filter((h) => h.isOpen)
      .sort((a, b) => b.rating - a.rating || a.currentWait - b.currentWait)
      .slice(0, 3);
  }, [halls]);

  const getMealPlanProjection = useCallback(() => {
    const weeksRemaining = Math.ceil(stats.daysRemaining / 7);
    const swipesPerWeek = stats.swipesPerWeek || 15;
    const target = plan.swipesRemaining / Math.max(weeksRemaining, 1);
    return Array.from({ length: Math.min(weeksRemaining, 8) }, (_, i) => ({
      week: i + 1,
      projected: Math.max(0, plan.swipesRemaining - swipesPerWeek * i),
      target: Math.round(target),
    }));
  }, [stats, plan]);

  return {
    halls,
    swipes,
    plan,
    favorites,
    nutrientLogs,
    stats,
    selectedHallId,
    setSelectedHallId,
    mealTypeFilter,
    setMealTypeFilter,
    hallFilter,
    setHallFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    logSwipe,
    removeSwipe,
    addFavorite,
    removeFavorite,
    rateHall,
    getHallById,
    getSwipesByHall,
    getSwipesByDate,
    getCalorieTrend,
    getNutrientBreakdown,
    getRecommendations,
    getMealPlanProjection,
  };
}

export { MEAL_TYPES, PLAN_TIERS };
