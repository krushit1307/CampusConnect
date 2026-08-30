import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useInfiniteQuery, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { HoverLink } from "@/components/ui/HoverLink";
import { SmartLink } from "@/components/ui/SmartLink";
import { EmptyState } from "@/components/EmptyState";
import { createClubProfileQueryOptions } from "@/lib/clubProfileQuery";
import { FilterSidebar, TAGS_SEARCH_PARAM } from "@/components/Clubs/FilterSidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Search from "lucide-react/dist/esm/icons/search";
import X from "lucide-react/dist/esm/icons/x";
import Users from "lucide-react/dist/esm/icons/users";
import Plus from "lucide-react/dist/esm/icons/plus";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { ClubCardSkeleton } from "@/components/ui/ClubCardSkeleton";

// Fixed (not Math.random) pattern so the skeleton layout never shifts
// between renders — avoids layout jumps and hydration mismatches.
const SKELETON_SIZES: Array<"sm" | "md" | "lg"> = [
  "md",
  "lg",
  "sm",
  "md",
  "sm",
  "lg",
  "md",
  "lg",
  "sm",
  "md",
  "lg",
  "sm",
];
export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  category?: string | null;
  club_tags?: { tag_id: string; club_tag_labels: { name: string } | null }[] | null;
  club_stats?: { total_members: number }[] | { total_members: number } | null;
}

const colors = [
  "bg-pink-100 text-pink-800 border-pink-200",
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-green-100 text-green-800 border-green-200",
  "bg-yellow-100 text-yellow-800 border-yellow-200",
  "bg-purple-100 text-purple-800 border-purple-200",
];

const PAGE_SIZE = 12;

export default function ClubsIndex() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Selected tags are read directly from the URL search params (single source
  // of truth), so a refreshed or shared link restores the exact filtered view.
  const activeTags = useMemo(() => {
    const raw = searchParams.get(TAGS_SEARCH_PARAM) ?? "";
    return raw
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }, [searchParams]);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery<{
    clubs: Club[];
    count: number;
  }>({
    queryKey: ["clubs-paginated", searchQuery, activeCategory, activeTags.join(",")],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, count, error } = await (supabase.rpc as any)(
        "get_filtered_clubs",
        {
          p_search: searchQuery.trim() || null,
          p_category: activeCategory !== "All" ? activeCategory : null,
          p_tags: activeTags.length > 0 ? activeTags : null,
        },
        { count: "exact" },
      )
        .select(
          `
          id, name, slug, description, banner_url, logo_url, category,
          club_stats(total_members),
          club_tags(tag_id, club_tag_labels(name))
        `,
        )
        .range((pageParam as number) * PAGE_SIZE, ((pageParam as number) + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      return { clubs: (data || []) as unknown as Club[], count: count ?? 0 };
    },
    getNextPageParam: (lastPage, allPages) => {
      const fetchedItems = allPages.reduce((total, page) => total + page.clubs.length, 0);
      return fetchedItems < lastPage.count ? allPages.length : undefined;
    },
  });

  const clubs = useMemo(() => data?.pages.flatMap((page: any) => page.clubs) || [], [data]);

  const { data: tagLabels = [] } = useQuery<string[]>({
    queryKey: ["club-tag-labels"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("club_tag_labels")
        .select("name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return (data || []).map((row: any) => row.name);
    },
  });

  const handlePrefetch = (slug: string) => {
    queryClient.prefetchQuery(createClubProfileQueryOptions(supabase, slug));
  };

  const categories = ["All", "Tech", "Cultural", "Academic", "Sports"];

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold font-display uppercase tracking-widest text-black mb-2">
              Explore Clubs
            </h1>
            <p className="font-mono text-xs text-gray-500">
              Join active campus communities, engineering groups, and cultural societies.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <HoverLink
              to="/clubs/fit"
              className="neu-border neu-press flex items-center justify-center gap-2 bg-emerald-400 px-4 py-2 font-mono text-sm font-bold uppercase text-black"
            >
              <Sparkles className="h-4 w-4" />
              Find Your Fit
            </HoverLink>

            <HoverLink
              to="/clubs/new"
              className="neu-border neu-press flex items-center justify-center gap-2 bg-sky px-4 py-2 font-mono text-sm font-bold uppercase text-black"
            >
              <Plus className="h-4 w-4" />
              Create a Club
            </HoverLink>

            {/* Search bar */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Search clubs by name or interest..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 border-2 border-black font-mono text-xs bg-white shadow-[2px_2px_0_0_#000]"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear Search Filter"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-gray-500 hover:text-black cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Categories Toolbar */}
        <div className="mb-8 p-4 border-2 border-black bg-cream shadow-[4px_4px_0_0_#000] flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="font-mono text-xs font-bold uppercase text-gray-700">
            Category Filter:
          </span>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                type="button"
                variant={activeCategory === cat ? "primary" : "outline"}
                onClick={() => setActiveCategory(cat)}
                className={`font-mono text-xs font-bold uppercase border-2 border-black h-8 px-3 rounded-none transition-all ${
                  activeCategory === cat
                    ? "bg-black text-white shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
                    : "bg-white text-black hover:bg-yellow-100"
                }`}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SKELETON_SIZES.map((size, i) => (
              <ClubCardSkeleton key={i} size={size} />
            ))}
          </div>
        ) : clubs.length === 0 ? (
          <div className="p-4">
            <EmptyState
              illustrationType="no-results"
              title={
                searchQuery
                  ? `No clubs match "${searchQuery}"`
                  : activeTags.length > 0
                    ? "No clubs match the selected tags"
                    : "No clubs found"
              }
              description="Try adjusting your search query or choosing different filters."
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clubs.map((c: Club, index: number) => {
                const membersCount = Array.isArray(c.club_stats)
                  ? (c.club_stats[0]?.total_members ?? 0)
                  : c.club_stats
                    ? (c.club_stats as { total_members: number }).total_members
                    : 0;

                return (
                  <div
                    key={c.id}
                    className="animate-fade-in-up flex flex-col"
                    onMouseEnter={() => handlePrefetch(c.slug)}
                  >
                    <HoverLink
                      to={`/clubs/${c.slug}`}
                      className="neu-border group flex flex-col bg-white p-6 shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all duration-300 ease-in-out hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[8px_8px_0_0_rgba(0,0,0,1)] h-full justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <div
                            className={`club-logo-badge border-2 border-black ${
                              colors[index % colors.length]
                            } px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase`}
                          >
                            {c.category || "Club"}
                          </div>
                        </div>

                        <h2 className="text-xl font-bold font-display text-black mb-2 line-clamp-1">
                          {c.name}
                        </h2>

                        <p className="font-mono text-xs text-gray-600 line-clamp-3 mb-6">
                          {c.description || "No description provided."}
                        </p>
                      </div>

                      <div>
                        <div className="my-3 border-t-2 border-black" />
                        <div className="flex items-center justify-between font-mono text-xs text-gray-800">
                          <span className="flex items-center gap-1">
                            <Users size={14} /> {membersCount} Members
                          </span>

                          <span className="font-bold uppercase flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                            View Profile{" "}
                            <span className="transition-transform duration-300 group-hover:translate-x-1">
                              →
                            </span>
                          </span>
                        </div>
                      </div>
                    </HoverLink>
                  </div>
                );
              })}
            </div>

            {hasNextPage && (
              <div className="flex justify-center mt-12 mb-8">
                <Button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="neu-border neu-press bg-black text-white hover:bg-gray-800 px-8 py-3 font-mono font-bold uppercase text-sm"
                >
                  {isFetchingNextPage ? "Loading..." : "Load More Clubs"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </SiteShell>
  );
}
