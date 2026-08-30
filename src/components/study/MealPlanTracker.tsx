import React, { useState } from "react";
import {
  Utensils,
  Clock,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Users,
  Star,
  MapPin,
  Calendar,
  Zap,
  Target,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Plus,
  ArrowRight,
  BarChart3,
  Award,
  Layers,
  CircleDot,
  Heart,
  Flame,
  DollarSign,
  TrendingDown,
  Circle,
} from "lucide-react";
import { useMealPlan, MEAL_TYPES, PLAN_TIERS } from "@/hooks/useMealPlan";
import type {
  DiningHallInfo,
  MealSwipe,
  MealType,
  DiningHall,
  MealPlanSortOption,
  MealPlanViewMode,
} from "@/hooks/useMealPlan";

// ─── Sub-components ──────────────────────────────────────────────────────────

function KPICard({
  icon,
  label,
  value,
  unit,
  color,
  bgColor,
  borderColor,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  color: string;
  bgColor: string;
  borderColor: string;
  progress?: number;
}) {
  return (
    <div
      className={`${bgColor} border ${borderColor} rounded-2xl p-4 transition-all hover:scale-[1.02] duration-200`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-black font-mono ${color}`}>{value}</span>
        <span className="text-[10px] font-mono text-slate-500">{unit}</span>
      </div>
      {progress !== undefined && (
        <div className="mt-2 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${color.replace("text-", "bg-")}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function HallCard({ hall, onSelect }: { hall: DiningHallInfo; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-2xl border transition-all cursor-pointer ${
        hall.isOpen
          ? "bg-slate-900/60 border-slate-800/60 hover:border-slate-700"
          : "bg-slate-900/30 border-slate-800/30 opacity-70"
      }`}
      onClick={() => onSelect(hall.id)}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{hall.icon}</span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${hall.isOpen ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}
            >
              {hall.isOpen ? "Open Now" : "Closed"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-[10px] font-mono font-bold text-amber-400">{hall.rating}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-slate-100 mb-1">{hall.name}</h3>
        <p className="text-[11px] text-slate-500 mb-2 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {hall.zone} Campus
        </p>

        {/* Wait + Hours */}
        <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500 mb-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {hall.openTime}–{hall.closeTime}
          </span>
          <span
            className={`flex items-center gap-1 ${hall.currentWait <= 5 ? "text-emerald-400" : hall.currentWait <= 15 ? "text-amber-400" : "text-red-400"}`}
          >
            <Zap className="w-3 h-3" /> ~{hall.currentWait} min wait
          </span>
        </div>

        {/* Today's Menu */}
        <div className="mb-3">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
            Today's Highlights
          </span>
          <div className="flex flex-wrap gap-1.5">
            {hall.todayMenu.slice(0, 4).map((item) => (
              <span
                key={item}
                className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400"
              >
                {item}
              </span>
            ))}
            {hall.todayMenu.length > 4 && (
              <span className="text-[9px] font-mono text-slate-600">
                +{hall.todayMenu.length - 4}
              </span>
            )}
          </div>
        </div>

        {/* Cuisine */}
        <div className="flex items-center gap-2 mb-3">
          {hall.cuisine.map((c) => (
            <span
              key={c}
              className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400"
            >
              {c}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-500">{hall.totalRatings} ratings</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-slate-300 transition"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Less" : "Menu"}
          </button>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-800/40 pt-4">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-2">
            Full Menu Today
          </span>
          <div className="space-y-1.5">
            {hall.todayMenu.map((item) => (
              <div key={item} className="flex items-center gap-2 text-[11px] text-slate-400">
                <Utensils className="w-3 h-3 text-slate-600" />
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SwipeHistoryCard({ swipe, hallName }: { swipe: MealSwipe; hallName: string }) {
  const mealInfo = MEAL_TYPES[swipe.mealType];
  return (
    <div className="flex items-center gap-3 bg-slate-950/40 rounded-xl px-4 py-3 border border-slate-800/40">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${mealInfo.bg} border ${mealInfo.border}`}
      >
        {mealInfo.icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-slate-200 truncate">{hallName}</h4>
        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 mt-0.5">
          <span className={mealInfo.color}>{mealInfo.label}</span>
          <span>{swipe.date}</span>
          <span>{swipe.time}</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {swipe.items.map((item) => (
            <span
              key={item}
              className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-500"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className="text-xs font-mono font-bold text-amber-400 block">
          {swipe.calories} cal
        </span>
        <span className="text-[9px] font-mono text-slate-500 block">${swipe.cost.toFixed(2)}</span>
        <span className="text-[8px] font-mono text-slate-600 block">{swipe.protein}g protein</span>
      </div>
    </div>
  );
}

function NutritionBar({
  label,
  value,
  max,
  color,
  unit,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  unit: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-mono font-bold text-slate-300">
          {value}
          {unit}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CalorieChart({ data }: { data: { date: string; calories: number }[] }) {
  const maxCal = Math.max(...data.map((d) => d.calories), 1);
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[8px] font-mono text-slate-600">{d.calories}</span>
          <div
            className="w-full rounded-t bg-gradient-to-t from-indigo-500 to-indigo-400 transition-all"
            style={{ height: `${(d.calories / maxCal) * 100}%`, minHeight: "4px" }}
          />
          <span className="text-[7px] font-mono text-slate-600">{d.date.split("-")[2]}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MealPlanTracker() {
  const {
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
    rateHall,
    getSwipesByHall,
    getCalorieTrend,
    getNutrientBreakdown,
    getRecommendations,
    getMealPlanProjection,
  } = useMealPlan();

  const [activeTab, setActiveTab] = useState<"overview" | "halls" | "history" | "nutrition">(
    "overview",
  );

  const selectedHall = selectedHallId ? halls.find((h) => h.id === selectedHallId) : null;
  const recommended = getRecommendations();
  const calorieTrend = getCalorieTrend();
  const nutrientBreakdown = getNutrientBreakdown();
  const projection = getMealPlanProjection();
  const planTier = PLAN_TIERS[plan.tier];

  const filteredSwipes = swipes
    .filter((s) => mealTypeFilter === "all" || s.mealType === mealTypeFilter)
    .filter((s) => hallFilter === "all" || s.diningHallId === hallFilter)
    .filter((s) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const hall = halls.find((h) => h.id === s.diningHallId);
      return (
        hall?.name.toLowerCase().includes(q) ||
        s.items.some((item) => item.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "calories":
          return b.calories - a.calories;
        case "hall":
          return a.diningHallId.localeCompare(b.diningHallId);
        case "cost":
          return b.cost - a.cost;
        case "date":
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-amber-900/50 via-orange-900/40 to-slate-900 border border-amber-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-amber-500/20 text-amber-300 text-xs px-3 py-1 rounded-full font-semibold border border-amber-500/30 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5" /> Meal Plan
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-amber-200 bg-clip-text text-transparent">
              Meal Plan Tracker
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Track your meal swipes, explore dining halls, monitor nutrition, and make the most of
              your campus meal plan.
            </p>
          </div>
          {/* Plan badge */}
          <div className="shrink-0 bg-slate-800/80 border border-slate-700 rounded-2xl p-4 text-center">
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider block mb-1 ${planTier.color}`}
            >
              {planTier.label} Plan
            </span>
            <span className="text-3xl font-black font-mono text-white block">
              {plan.swipesRemaining}
            </span>
            <span className="text-[10px] font-mono text-slate-500">swipes left</span>
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${(plan.swipesRemaining / plan.swipesTotal) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            {[
              { key: "overview" as const, label: "Overview", icon: <Target className="w-4 h-4" /> },
              {
                key: "halls" as const,
                label: "Dining Halls",
                icon: <MapPin className="w-4 h-4" />,
              },
              {
                key: "history" as const,
                label: "Swipe History",
                icon: <Clock className="w-4 h-4" />,
              },
              {
                key: "nutrition" as const,
                label: "Nutrition",
                icon: <Flame className="w-4 h-4" />,
              },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                  activeTab === key
                    ? "bg-amber-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            icon={<Utensils className="w-5 h-5" />}
            label="Total Swipes"
            value={stats.totalSwipes.toString()}
            unit={`of ${plan.swipesTotal}`}
            color="text-amber-400"
            bgColor="bg-amber-500/10"
            borderColor="border-amber-500/30"
            progress={stats.percentUsed}
          />
          <KPICard
            icon={<Flame className="w-5 h-5" />}
            label="Avg Calories"
            value={stats.avgCaloriesPerDay.toString()}
            unit="cal/day"
            color="text-rose-400"
            bgColor="bg-rose-500/10"
            borderColor="border-rose-500/30"
          />
          <KPICard
            icon={<DollarSign className="w-5 h-5" />}
            label="Dining Dollars"
            value={`$${plan.diningDollars.toFixed(0)}`}
            unit={`of $${plan.diningDollarsTotal}`}
            color="text-emerald-400"
            bgColor="bg-emerald-500/10"
            borderColor="border-emerald-500/30"
            progress={(plan.diningDollars / plan.diningDollarsTotal) * 100}
          />
          <KPICard
            icon={<Calendar className="w-5 h-5" />}
            label="Days Left"
            value={stats.daysRemaining.toString()}
            unit="days"
            color="text-purple-400"
            bgColor="bg-purple-500/10"
            borderColor="border-purple-500/30"
          />
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* Recommended Halls */}
            {recommended.length > 0 && (
              <div className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-mono font-bold text-amber-300 uppercase tracking-wider">
                    Top Rated Open Halls
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {recommended.map((hall) => (
                    <button
                      key={hall.id}
                      onClick={() => setSelectedHallId(hall.id)}
                      className="flex items-center gap-3 bg-slate-900/60 rounded-xl p-3 border border-slate-800/60 hover:border-amber-500/30 transition text-left"
                    >
                      <span className="text-2xl">{hall.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-200 truncate">{hall.name}</h4>
                        <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 mt-0.5">
                          <span className="text-amber-400">⭐ {hall.rating}</span>
                          <span>~{hall.currentWait}m wait</span>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Favorites */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Heart className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Favorite Items
                </h3>
              </div>
              <div className="space-y-2">
                {favorites.slice(0, 4).map((fav) => {
                  const hall = halls.find((h) => h.id === fav.diningHallId);
                  return (
                    <div
                      key={fav.id}
                      className="flex items-center gap-3 bg-slate-950/40 rounded-xl px-3 py-2.5 border border-slate-800/40"
                    >
                      <Heart className="w-4 h-4 text-rose-400 fill-rose-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-slate-200">{fav.name}</span>
                        <span className="text-[9px] font-mono text-slate-500 ml-2">
                          {hall?.name}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-amber-400">
                        {fav.calories} cal
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">×{fav.orderCount}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Meal Plan Projection */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Swipe Projection
                </h3>
              </div>
              <div className="space-y-2">
                {projection.map((p) => (
                  <div key={p.week} className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-slate-500 w-12">Wk {p.week}</span>
                    <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden relative">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
                        style={{ width: `${(p.projected / plan.swipesTotal) * 100}%` }}
                      />
                      <div
                        className="absolute top-0 h-full w-px bg-red-500"
                        style={{ left: `${(p.target / plan.swipesTotal) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 w-8 text-right">
                      {p.projected}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dining Halls Tab */}
        {activeTab === "halls" && (
          <div className="space-y-4">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search dining halls..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-amber-500 transition"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {halls
                .filter(
                  (h) =>
                    !searchQuery ||
                    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    h.zone.toLowerCase().includes(searchQuery.toLowerCase()),
                )
                .map((hall) => (
                  <HallCard key={hall.id} hall={hall} onSelect={setSelectedHallId} />
                ))}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setMealTypeFilter("all")}
                  className={`px-3 py-2 rounded-xl text-[10px] font-mono font-bold border transition whitespace-nowrap ${
                    mealTypeFilter === "all"
                      ? "bg-slate-700 border-slate-600 text-slate-200"
                      : "bg-slate-900/60 border-slate-800 text-slate-500"
                  }`}
                >
                  All Meals
                </button>
                {(Object.entries(MEAL_TYPES) as [MealType, (typeof MEAL_TYPES)[MealType]][]).map(
                  ([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setMealTypeFilter(key)}
                      className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-mono font-bold border transition whitespace-nowrap ${
                        mealTypeFilter === key
                          ? `${info.bg} ${info.color} ${info.border}`
                          : "bg-slate-900/60 border-slate-800 text-slate-500"
                      }`}
                    >
                      {info.icon} {info.label}
                    </button>
                  ),
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={hallFilter}
                  onChange={(e) => setHallFilter(e.target.value as DiningHall | "all")}
                  className="px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Halls</option>
                  {halls.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.icon} {h.name}
                    </option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as MealPlanSortOption)}
                  className="px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="date">📅 Date</option>
                  <option value="calories">🔥 Calories</option>
                  <option value="cost">💰 Cost</option>
                  <option value="hall">🏢 Hall</option>
                </select>
              </div>
            </div>

            {/* Swipe List */}
            <div className="space-y-2">
              {filteredSwipes.map((swipe) => {
                const hall = halls.find((h) => h.id === swipe.diningHallId);
                return (
                  <SwipeHistoryCard
                    key={swipe.id}
                    swipe={swipe}
                    hallName={hall?.name || "Unknown"}
                  />
                );
              })}
            </div>
            {filteredSwipes.length === 0 && (
              <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800/60">
                <Utensils className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-400">No swipes found</h3>
                <p className="text-slate-600 text-sm mt-1">Try adjusting your filters</p>
              </div>
            )}
          </div>
        )}

        {/* Nutrition Tab */}
        {activeTab === "nutrition" && (
          <div className="space-y-5">
            {/* Calorie Trend */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Calorie Trend (7 Days)
                </h3>
              </div>
              <CalorieChart data={calorieTrend} />
              <div className="text-center mt-3">
                <span className="text-[10px] font-mono text-slate-500">
                  Average:{" "}
                  <span className="text-rose-400 font-bold">{stats.avgCaloriesPerDay} cal/day</span>
                </span>
              </div>
            </div>

            {/* Nutrient Breakdown */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Today's Nutrient Split
                </h3>
              </div>
              <div className="space-y-4">
                {nutrientBreakdown.map((n) => (
                  <div key={n.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs ${n.color}`}>{n.label}</span>
                      <span className="text-xs font-mono text-slate-300">
                        {n.value}g ({n.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${n.color.replace("text-", "bg-")}`}
                        style={{ width: `${n.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Log Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Daily Nutrition Log
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] font-mono text-slate-500 uppercase border-b border-slate-800">
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-right py-2 px-2">Calories</th>
                      <th className="text-right py-2 px-2">Protein</th>
                      <th className="text-right py-2 px-2">Carbs</th>
                      <th className="text-right py-2 px-2">Fat</th>
                      <th className="text-right py-2 px-2">Fiber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nutrientLogs.map((log) => (
                      <tr key={log.date} className="border-b border-slate-800/50">
                        <td className="py-2 px-2 text-slate-300">{log.date}</td>
                        <td className="py-2 px-2 text-right font-mono text-rose-400">
                          {log.calories}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-blue-400">
                          {log.protein}g
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-emerald-400">
                          {log.carbs}g
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-amber-400">
                          {log.fat}g
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-purple-400">
                          {log.fiber}g
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Protein Goal */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Nutrition Goals
                </h3>
              </div>
              <div className="space-y-4">
                <NutritionBar
                  label="Calories"
                  value={stats.avgCaloriesPerDay}
                  max={2200}
                  color="bg-rose-500"
                  unit=" cal"
                />
                <NutritionBar
                  label="Protein"
                  value={stats.avgProteinPerDay}
                  max={65}
                  color="bg-blue-500"
                  unit="g"
                />
                <NutritionBar
                  label="Fiber"
                  value={nutrientLogs[0]?.fiber || 0}
                  max={25}
                  color="bg-emerald-500"
                  unit="g"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Hall Detail Modal */}
      {selectedHall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setSelectedHallId(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-800 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{selectedHall.icon}</span>
                  <button
                    onClick={() => setSelectedHallId(null)}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <h2 className="text-xl font-extrabold text-white mb-1">{selectedHall.name}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <MapPin className="w-3 h-3" /> {selectedHall.zone} Campus
                  <span className="text-slate-500">•</span>
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {selectedHall.rating} (
                  {selectedHall.totalRatings})<span className="text-slate-500">•</span>
                  <Clock className="w-3 h-3" /> {selectedHall.openTime}–{selectedHall.closeTime}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-2">
                  Today's Menu
                </span>
                <div className="space-y-1.5">
                  {selectedHall.todayMenu.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 bg-slate-950/40 rounded-lg px-3 py-2 border border-slate-800/40"
                    >
                      <Utensils className="w-3 h-3 text-slate-600" />
                      <span className="text-xs text-slate-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-2">
                  Cuisine Types
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedHall.cuisine.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/40">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500">Current Wait</span>
                  <span
                    className={`text-xs font-mono font-bold ${selectedHall.currentWait <= 5 ? "text-emerald-400" : selectedHall.currentWait <= 15 ? "text-amber-400" : "text-red-400"}`}
                  >
                    ~{selectedHall.currentWait} minutes
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    logSwipe({
                      userId: "u-self",
                      diningHallId: selectedHall.id,
                      mealType: "lunch",
                      date: new Date().toISOString().split("T")[0],
                      time: new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                      items: selectedHall.todayMenu.slice(0, 2),
                      calories: 600,
                      protein: 25,
                      carbs: 70,
                      fat: 22,
                      cost: 9.5,
                    });
                    setSelectedHallId(null);
                  }}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-amber-500/20"
                >
                  Log Swipe Here
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
