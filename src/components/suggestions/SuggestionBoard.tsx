import { useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Lightbulb,
  Plus,
  ArrowUpDown,
  LayoutGrid,
  List,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSuggestions } from "@/hooks/useSuggestions";
import { useSuggestionStore } from "@/store/useSuggestionStore";
import { SuggestionCard } from "@/components/suggestions/SuggestionCard";
import { SuggestionForm } from "@/components/suggestions/SuggestionForm";
import { SuggestionFilters } from "@/components/suggestions/SuggestionFilters";
import { SuggestionStatsPanel } from "@/components/suggestions/SuggestionStats";
import { SuggestionDetail } from "@/components/suggestions/SuggestionDetail";
import type { EventSuggestion } from "@/types/suggestions";
import { cn } from "@/lib/utils";

interface SuggestionBoardProps {
  currentUserId: string | null;
  currentUserName: string;
  currentUserAvatar: string | null;
  isAdmin: boolean;
  clubId?: string | null;
}

type ViewMode = "grid" | "list";

export function SuggestionBoard({
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isAdmin,
  clubId = null,
}: SuggestionBoardProps) {
  const { filters, setFormOpen, setDetailOpen, setSelectedSuggestion } = useSuggestionStore();
  const { data: suggestions, isLoading, isError, refetch, isFetching } = useSuggestions(filters);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelectSuggestion = useCallback(
    (suggestion: EventSuggestion) => {
      setSelectedId(suggestion.id);
      setSelectedSuggestion(suggestion);
      setDetailOpen(true);
    },
    [setSelectedSuggestion, setDetailOpen],
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedId(null);
    setSelectedSuggestion(null);
    setDetailOpen(false);
  }, [setSelectedSuggestion, setDetailOpen]);

  const suggestionCount = suggestions?.length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2Mmgxem0tMTItNHYySDExdi0yaDN6bTAgNHYySDExdi0yaDN6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Lightbulb className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                  Event Suggestions
                </h1>
                <p className="text-indigo-200 text-sm mt-0.5">
                  Propose ideas, vote on favorites, and shape your campus events
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-6">
              {currentUserId && (
                <Button
                  onClick={() => setFormOpen(true)}
                  className="rounded-full gap-2 bg-white text-indigo-700 hover:bg-indigo-50 font-bold shadow-lg"
                >
                  <Plus className="h-4 w-4" />
                  Suggest Event
                </Button>
              )}

              <div className="flex items-center gap-2 text-sm text-indigo-200">
                <span className="font-mono tabular-nums">{suggestionCount}</span>
                <span>suggestion{suggestionCount !== 1 ? "s" : ""}</span>
                {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin ml-1" />}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        <SuggestionStatsPanel clubId={clubId} />

        {/* Filters */}
        <SuggestionFilters />

        {/* View toggle + sort info */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-700">{suggestionCount}</span>{" "}
            suggestion{suggestionCount !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                : "space-y-3",
            )}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl bg-white border border-gray-200 animate-pulse",
                  viewMode === "grid" ? "h-64 p-5" : "h-24 p-4",
                )}
              >
                <div className="flex gap-2 mb-3">
                  <div className="h-5 w-20 rounded-full bg-gray-200" />
                  <div className="h-5 w-16 rounded-full bg-gray-200" />
                </div>
                <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-full bg-gray-100 rounded mb-1" />
                <div className="h-4 w-2/3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-red-800 mb-1">Failed to load suggestions</h3>
            <p className="text-sm text-red-600 mb-4">
              Something went wrong while fetching suggestions. Please try again.
            </p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="rounded-full gap-2 border-red-300 text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && suggestionCount === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center"
          >
            <div className="h-16 w-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
              <Lightbulb className="h-8 w-8 text-indigo-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No suggestions yet</h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-6">
              Be the first to propose an event idea! Your suggestion will appear here for others to
              vote on.
            </p>
            {currentUserId && (
              <Button
                onClick={() => setFormOpen(true)}
                className="rounded-full gap-2 bg-indigo-600 hover:bg-indigo-700 font-bold"
              >
                <Plus className="h-4 w-4" />
                Suggest Your First Event
              </Button>
            )}
          </motion.div>
        )}

        {/* Suggestions grid/list */}
        {!isLoading && !isError && suggestionCount > 0 && (
          <div
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                : "space-y-3",
            )}
          >
            <AnimatePresence mode="popLayout">
              {suggestions?.map((suggestion, index) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onSelect={handleSelectSuggestion}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Create form dialog */}
      {currentUserId && (
        <SuggestionForm
          userId={currentUserId}
          userName={currentUserName}
          userAvatar={currentUserAvatar}
          clubId={clubId}
        />
      )}

      {/* Detail slide-out */}
      <SuggestionDetail
        suggestionId={selectedId}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        isAdmin={isAdmin}
        onClose={handleCloseDetail}
      />
    </div>
  );
}
