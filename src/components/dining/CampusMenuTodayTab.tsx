import React, { useEffect, useState, useMemo } from "react";
import {
  CampusMenuCrowdService,
  DiningHall,
  DiningMenu,
  MenuItem,
  MealPeriod,
  InformalDiningMeetup,
} from "@/services/campusMenuCrowdService";
import { CreateInformalMeetupModal } from "./CreateInformalMeetupModal";
import { InformalMeetupCard } from "./InformalMeetupCard";
import {
  Utensils,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Users,
  Search,
  Filter,
  Flame,
  ShieldAlert,
  Calendar,
  Clock,
  ChevronRight,
  PlusCircle,
  TrendingUp,
} from "lucide-react";

interface CampusMenuTodayTabProps {
  initialDiningHallId?: string;
  currentUserId?: string;
  currentUserName?: string;
}

export const CampusMenuTodayTab: React.FC<CampusMenuTodayTabProps> = ({
  initialDiningHallId = "hall-south-02",
  currentUserId = "user-current-student-01",
  currentUserName = "Alex Chen",
}) => {
  const [halls, setHalls] = useState<DiningHall[]>([]);
  const [selectedHallId, setSelectedHallId] = useState<string>(initialDiningHallId);
  const [mealPeriod, setMealPeriod] = useState<MealPeriod>("lunch");
  const [menu, setMenu] = useState<DiningMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeDietaryFilters, setActiveDietaryFilters] = useState<string[]>([]);
  const [activeMeetups, setActiveMeetups] = useState<InformalDiningMeetup[]>([]);

  // Meetup modal state
  const [isMeetupModalOpen, setIsMeetupModalOpen] = useState(false);
  const [selectedItemForMeetup, setSelectedItemForMeetup] = useState<MenuItem | null>(null);

  const dietaryOptions = ["Vegan", "Vegetarian", "Halal", "Gluten-Free", "High-Protein"];
  const categories = ["All", "Entree", "Side", "Salad", "Dessert"];

  useEffect(() => {
    const loadedHalls = CampusMenuCrowdService.getDiningHalls();
    setHalls(loadedHalls);
    if (!loadedHalls.some((h) => h.id === selectedHallId) && loadedHalls.length > 0) {
      setSelectedHallId(loadedHalls[0].id);
    }
  }, []);

  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      try {
        const data = await CampusMenuCrowdService.getDailyMenu(
          selectedHallId,
          undefined,
          mealPeriod,
        );
        setMenu(data);
        const meetups = CampusMenuCrowdService.getActiveMeetups(selectedHallId);
        setActiveMeetups(meetups);
      } catch (err) {
        console.error("Failed to load dining menu:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, [selectedHallId, mealPeriod]);

  const handleVote = async (menuItemId: string, voteType: "UP" | "DOWN") => {
    try {
      const { item: updatedItem } = await CampusMenuCrowdService.voteMenuItem(
        menuItemId,
        currentUserId,
        voteType,
      );

      if (menu) {
        setMenu({
          ...menu,
          items: menu.items.map((i) => (i.id === updatedItem.id ? updatedItem : i)),
        });
      }
    } catch (err) {
      console.error("Voting error:", err);
    }
  };

  const toggleDietaryFilter = (flag: string) => {
    setActiveDietaryFilters((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag],
    );
  };

  const filteredItems = useMemo(() => {
    if (!menu) return [];
    return CampusMenuCrowdService.filterMenuItems(menu.items, {
      searchQuery,
      category: selectedCategory,
      dietaryFlags: activeDietaryFilters,
    });
  }, [menu, searchQuery, selectedCategory, activeDietaryFilters]);

  const openMeetupModal = (item: MenuItem) => {
    setSelectedItemForMeetup(item);
    setIsMeetupModalOpen(true);
  };

  const handleMeetupCreated = (newMeetup: InformalDiningMeetup) => {
    setActiveMeetups((prev) => [newMeetup, ...prev]);
  };

  const handleMeetupUpdated = (updated: InformalDiningMeetup) => {
    setActiveMeetups((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const currentHall = halls.find((h) => h.id === selectedHallId);

  return (
    <div className="w-full space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-2">
              <Flame className="w-3.5 h-3.5 text-yellow-200 animate-pulse" />
              Live Crowd-Sourced Dining Grid
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Today's Campus Menus & Meetups
            </h1>
            <p className="text-sm md:text-base text-orange-100 mt-1 max-w-xl">
              Real-time daily menus, crowd food quality ratings, and dish-linked informal club
              hangouts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Dining Hall Select */}
            <select
              value={selectedHallId}
              onChange={(e) => setSelectedHallId(e.target.value)}
              className="px-4 py-2.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-900 dark:text-white font-semibold text-sm shadow-md border-0 focus:ring-2 focus:ring-white"
            >
              {halls.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.campusZone})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Control Bar: Meal Period & Search & Dietary */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Meal Periods */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          {(["breakfast", "lunch", "dinner", "late_night"] as MealPeriod[]).map((period) => (
            <button
              key={period}
              onClick={() => setMealPeriod(period)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                mealPeriod === period
                  ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {period.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dish, station, or ingredients..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-orange-500 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Dietary Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Dietary:
        </span>
        {dietaryOptions.map((flag) => {
          const isActive = activeDietaryFilters.includes(flag);
          return (
            <button
              key={flag}
              onClick={() => toggleDietaryFilter(flag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {flag}
            </button>
          );
        })}
      </div>

      {/* Main Grid: Menu Dishes & Meetups Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Dishes List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Utensils className="w-5 h-5 text-orange-500" />
              {currentHall ? currentHall.name : "Dining Hall"} Menu
              <span className="text-xs font-normal text-slate-500">
                ({filteredItems.length} items available)
              </span>
            </h3>
            {menu?.isCached && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium">
                ⚡ 24h Redis Cached
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 animate-pulse">
              Fetching daily menu & crowd ratings...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-500">
              No menu items match your current filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-md transition-all group"
                >
                  <div>
                    {/* Top Station & Crowd Rating */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                        {item.stationName}
                      </span>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-xs font-bold">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        {item.crowdRating.toFixed(1)} / 5.0
                      </div>
                    </div>

                    <h4 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-orange-500 transition-colors">
                      {item.name}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 mb-3 line-clamp-2">
                      {item.description}
                    </p>

                    {/* Nutrition Breakdown */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mb-3 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-xl font-medium">
                      <span>🔥 {item.calories} kcal</span>
                      <span>🥩 {item.proteinG}g P</span>
                      <span>🍞 {item.carbsG}g C</span>
                      <span>🥑 {item.fatG}g F</span>
                    </div>

                    {/* Dietary & Allergen tags */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-4">
                      {item.dietaryFlags.map((flag) => (
                        <span
                          key={flag}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                        >
                          {flag}
                        </span>
                      ))}
                      {item.allergens.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-0.5">
                          <ShieldAlert className="w-2.5 h-2.5" />
                          {item.allergens.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions: Voting & Host Meetup */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleVote(item.id, "UP")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-300 hover:text-emerald-700 transition-colors"
                        title="Upvote item"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>{item.upvotesCount}</span>
                      </button>
                      <button
                        onClick={() => handleVote(item.id, "DOWN")}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-700 dark:text-slate-300 hover:text-rose-700 transition-colors"
                        title="Downvote item"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span>{item.downvotesCount}</span>
                      </button>
                    </div>

                    <button
                      onClick={() => openMeetupModal(item)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/50 dark:hover:bg-orange-900/60 text-orange-600 dark:text-orange-300 transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Host Meetup
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Informal Meetups for this Dining Hall */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              Active Meetups
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
              {activeMeetups.length} Squads
            </span>
          </div>

          {activeMeetups.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-500">
              <Utensils className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No meetups organized yet!
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Pick a dish you love from the menu and click "Host Meetup" to invite peers.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeMeetups.map((meetup) => (
                <InformalMeetupCard
                  key={meetup.id}
                  meetup={meetup}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  onMeetupUpdated={handleMeetupUpdated}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Meetup Modal */}
      <CreateInformalMeetupModal
        isOpen={isMeetupModalOpen}
        onClose={() => setIsMeetupModalOpen(false)}
        menuItem={selectedItemForMeetup}
        diningHallId={selectedHallId}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onMeetupCreated={handleMeetupCreated}
      />
    </div>
  );
};
