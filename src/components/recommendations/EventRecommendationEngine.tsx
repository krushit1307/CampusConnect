/**
 * EventRecommendationEngine — Full-page recommendation dashboard.
 *
 * Shows personalized event recommendations organized into sections:
 * Top Picks, Because You Liked, Trending, and Hidden Gems.
 * Includes user preference summary, insights panel, and filters.
 */

import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Heart, Gem, RefreshCw } from "lucide-react";
import { useEventRecommendations } from "@/hooks/useEventRecommendations";
import { UserPreferenceCard } from "./UserPreferenceCard";
import { RecommendedEventCard } from "./RecommendedEventCard";
import { RecommendationInsights } from "./RecommendationInsights";
import { RecommendationFilters } from "./RecommendationFilters";
import { MOCK_USER_PREFERENCES, EventCategory } from "@/utils/recommendationEngine";

export default function EventRecommendationEngine() {
  const {
    scoredEvents,
    recommendations,
    filters,
    userStats,
    addInteraction,
    updateFilters,
    toggleCategory,
    resetFilters,
  } = useEventRecommendations();

  const { topPicks, becauseYouLiked, trendingNearYou, hiddenGems } = recommendations;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <Sparkles className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Recommended For You
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Personalized event suggestions based on your interests and activity
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="mb-6">
        <RecommendationFilters
          filters={filters}
          onToggleCategory={toggleCategory}
          onUpdateFilter={updateFilters}
          onReset={resetFilters}
        />
      </div>

      {/* Content */}
      {scoredEvents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <Sparkles className="w-16 h-16 text-gray-700 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Matches Found</h2>
          <p className="text-gray-400 text-sm text-center max-w-md">
            No events match your current filters. Try clearing some filters or adjusting your
            preferences.
          </p>
          <button
            onClick={resetFilters}
            className="mt-6 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-all"
          >
            Clear Filters
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Left Sidebar — User Profile + Insights */}
          <div className="xl:col-span-1 space-y-6">
            <UserPreferenceCard
              userStats={userStats}
              categoryAffinities={MOCK_USER_PREFERENCES.categoryAffinities}
            />
            <RecommendationInsights scoredEvents={scoredEvents} />
          </div>

          {/* Main Content — Recommendation Sections */}
          <div className="xl:col-span-3 space-y-8">
            {/* Top Picks */}
            <Section
              icon={<Sparkles className="w-5 h-5 text-cyan-400" />}
              title="Top Picks For You"
              subtitle="Best matches based on your profile"
              count={topPicks.length}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topPicks.map((s, i) => (
                  <RecommendedEventCard
                    key={s.event.id}
                    scored={s}
                    index={i}
                    onRsvp={(id) => addInteraction(id, "rsvp")}
                    onBookmark={(id) => addInteraction(id, "bookmark")}
                    onSkip={(id) => addInteraction(id, "skip")}
                  />
                ))}
              </div>
            </Section>

            {/* Because You Liked */}
            {becauseYouLiked.length > 0 && (
              <Section
                icon={<Heart className="w-5 h-5 text-rose-400" />}
                title="Because You Liked..."
                subtitle="Similar to events you've attended or bookmarked"
                count={becauseYouLiked.length}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {becauseYouLiked.map((s, i) => (
                    <RecommendedEventCard
                      key={s.event.id}
                      scored={s}
                      index={i}
                      onRsvp={(id) => addInteraction(id, "rsvp")}
                      onBookmark={(id) => addInteraction(id, "bookmark")}
                      onSkip={(id) => addInteraction(id, "skip")}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* Trending */}
            {trendingNearYou.length > 0 && (
              <Section
                icon={<TrendingUp className="w-5 h-5 text-amber-400" />}
                title="Trending on Campus"
                subtitle="Hot events with high RSVP velocity"
                count={trendingNearYou.length}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trendingNearYou.map((s, i) => (
                    <RecommendedEventCard
                      key={s.event.id}
                      scored={s}
                      index={i}
                      onRsvp={(id) => addInteraction(id, "rsvp")}
                      onBookmark={(id) => addInteraction(id, "bookmark")}
                      onSkip={(id) => addInteraction(id, "skip")}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* Hidden Gems */}
            {hiddenGems.length > 0 && (
              <Section
                icon={<Gem className="w-5 h-5 text-teal-400" />}
                title="Hidden Gems"
                subtitle="Great events with low visibility — beat the crowd"
                count={hiddenGems.length}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hiddenGems.map((s, i) => (
                    <RecommendedEventCard
                      key={s.event.id}
                      scored={s}
                      index={i}
                      onRsvp={(id) => addInteraction(id, "rsvp")}
                      onBookmark={(id) => addInteraction(id, "bookmark")}
                      onSkip={(id) => addInteraction(id, "skip")}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center text-gray-600 text-[10px] pb-4"
            >
              CampusConnect Recommendation Engine · Content-based + Collaborative Filtering ·
              Personalized in real-time
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section Wrapper ────────────────────────────────────────────────

function Section({
  icon,
  title,
  subtitle,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-white font-semibold text-lg">{title}</h2>
        </div>
        <span className="px-2 py-0.5 rounded-md text-[10px] bg-white/10 text-gray-400 font-medium">
          {count}
        </span>
        <span className="text-gray-600 text-xs hidden md:inline">— {subtitle}</span>
      </div>
      {children}
    </motion.div>
  );
}
