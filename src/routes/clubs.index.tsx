import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { HoverLink } from "@/components/ui/HoverLink";
import { EmptyState } from "@/components/EmptyState";
import { createClubProfileQueryOptions } from "@/lib/clubProfileQuery";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Users, Plus } from "lucide-react";
import { ClubCardSkeleton } from "@/components/ui/ClubCardSkeleton";

// Fixed (not Math.random) pattern so the skeleton layout never shifts
// between renders — avoids layout jumps and hydration mismatches.
const SKELETON_SIZES: Array<"sm" | "md" | "lg"> = [
  "md", "lg", "sm", "md", "sm", "lg",
  "md", "lg", "sm", "md", "lg", "sm",
];
interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  category?: string | null;
  club_stats?: { total_members: number }[] | { total_members: number } | null;
}

const colors = [
  "bg-pink-100 text-pink-800 border-pink-200",
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-green-100 text-green-800 border-green-200",
  "bg-yellow-100 text-yellow-800 border-yellow-200",
  "bg-purple-100 text-purple-800 border-purple-200",
];

export default function ClubsIndex() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const { data: clubs = [], isLoading } = useQuery<Club[]>({
    queryKey: ["clubs", searchQuery],
    queryFn: async () => {
      if (searchQuery.trim()) {
        try {
          const { data, error } = await supabase.rpc("search_clubs", {
            search_term: searchQuery,
          });
          if (!error && data) return data as Club[];
        } catch (e) {
          console.warn("RPC search_clubs failed, falling back to client filter", e);
        }
      }

      const { data, error } = await supabase.from("clubs").select(`
          id, name, slug, description, banner_url, logo_url, category,
          club_stats(total_members)
        `);
      if (error) throw error;
      return (data || []) as Club[];
    },
  });

  // Filter by category + search query (as client-side fallback/filter)
  const filteredClubs = useMemo(() => {
    return clubs.filter((c) => {
      // Category filter
      if (activeCategory !== "All") {
        const cat = c.category?.toLowerCase() || "";
        if (cat !== activeCategory.toLowerCase()) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesDesc = c.description?.toLowerCase().includes(q) || false;
        return matchesName || matchesDesc;
      }

      return true;
    });
  }, [clubs, activeCategory, searchQuery]);

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
                variant={activeCategory === cat ? "default" : "outline"}
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
) : filteredClubs.length === 0 ? (
          <div className="p-4">
            <EmptyState
              illustrationType="no-results"
              title={searchQuery ? `No clubs match "${searchQuery}"` : "No clubs found"}
              description="Try adjusting your search query or choosing a different category filter."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClubs.map((c, index) => {
              const membersCount = Array.isArray(c.club_stats)
                ? (c.club_stats[0]?.total_members ?? 0)
                : (c.club_stats ? (c.club_stats as { total_members: number }).total_members : 0);

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
        )}
      </div>
    </SiteShell>
  );
}
