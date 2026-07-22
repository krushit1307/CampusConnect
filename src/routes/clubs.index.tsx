import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { useInfiniteQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { LayoutGrid, List, UsersRound, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { CreateClubDialog } from "@/components/CreateClubDialog";
import { ClubCardSkeleton } from "@/components/ui/ClubCardSkeleton";

const ITEMS_PER_PAGE = 12;
const VIEW_MODE_STORAGE_KEY = "clubs-view-mode";

type ViewMode = "grid" | "list";

export default function ClubsIndex() {
  const supabase = createClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [viewModeLoaded, setViewModeLoaded] = useState(false);

  useEffect(() => {
    const savedViewMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (savedViewMode === "grid" || savedViewMode === "list") {
      setViewMode(savedViewMode);
    }
    setViewModeLoaded(true);
  }, []);

  useEffect(() => {
    if (!viewModeLoaded) return;
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode, viewModeLoaded]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Switch to useInfiniteQuery for chunk-by-chunk data loading
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useInfiniteQuery({
      queryKey: ["clubs"],
      initialPageParam: 0,
      queryFn: async ({ pageParam = 0 }) => {
        const from = pageParam * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        const { data, count } = await supabase
          .from("clubs")
          .select(`id, name, slug, description`, { count: "exact" })
          .range(from, to);

        return {
          clubs: data || [],
          nextPage: (data || []).length === ITEMS_PER_PAGE ? pageParam + 1 : undefined,
          totalCount: count || 0,
        };
      },
      getNextPageParam: (lastPage) => lastPage.nextPage,
    });

  // Flatten the nested page arrays from useInfiniteQuery into a single list
  const allClubs = data?.pages.flatMap((page) => page.clubs) || [];
  const totalActiveCount = data?.pages[0]?.totalCount || allClubs.length;

  // Deriving the Top 3 Trending Clubs based on member_count
  const trendingClubs = [...allClubs].slice(0, 3);

  useEffect(() => {
    const handleRefetch = () => refetch();
    window.addEventListener("refetchClubs", handleRefetch);
    return () => window.removeEventListener("refetchClubs", handleRefetch);
  }, [refetch]);

  const colors = ["bg-lime", "bg-sky", "bg-lavender", "bg-peach"];

  const filteredClubs = allClubs.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || "").toLowerCase().includes(search.toLowerCase()),
  );

  const directoryClubs = filteredClubs.filter(
    (c) => search || !trendingClubs.find((t) => t.slug === c.slug),
  );

  return (
    <SiteShell>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          opacity: 0;
          animation: fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes zoomIn {
          from {
            opacity: 0;
            transform: scale(0.85);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .club-logo-badge {
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          animation: zoomIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .group:hover .club-logo-badge {
          transform: scale(1.08);
          box-shadow: 4px 4px 0 0 #000;
        }
      `}</style>
      <section className="border-b-2 border-black bg-sky px-4 py-14 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <p className="eyebrow font-bold">Club directory · {totalActiveCount} active</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl md:text-6xl">Find your people.</h1>
            <div className="relative mt-6 max-w-xl">
              <input
                ref={inputRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search clubs by name or interest..."
                className="neu-border w-full bg-white px-4 py-3 pr-10 font-mono text-sm outline-none text-black"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black dark:text-gray-300 dark:hover:text-white"
                  aria-label="Clear search"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
          <div>
            <CreateClubDialog user={user} />
          </div>
        </div>
      </section>

      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-7xl">
          {/* Dynamic Popular/Trending Clubs Container */}
          {!isLoading && allClubs.length > 0 && !search && (
            <div className="mb-14 animate-fade-in-up">
              <h2 className="mb-6 font-mono text-xs font-black uppercase tracking-widest text-gray-600 flex items-center gap-2">
                <span>🔥</span> POPULAR / TRENDING CLUBS
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {trendingClubs.map((c) => {
                  return (
                    <Link
                      key={`trending-${c.slug}`}
                      to={`/clubs/${c.slug}`}
                      className="neu-border group relative block bg-white p-6 shadow-[4px_4px_0_0_var(--color-ink)] transition-all duration-300 ease-in-out hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[8px_8px_0_0_var(--color-ink)] flex flex-col justify-between"
                    >
                      <span className="absolute -right-2 -top-3 neu-border bg-yellow text-black px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0_0_var(--color-ink)] rotate-2">
                        ✨ Trending
                      </span>
                      <div>
                        <div className="neu-border bg-black mb-4 inline-block px-3 py-1 font-mono text-xs font-bold uppercase text-white">
                          Top Tier
                        </div>
                        <h3 className="text-2xl font-bold text-black">{c.name}</h3>
                        <p className="my-3 font-mono text-xs text-gray-600 line-clamp-2">
                          {c.description || "No description provided."}
                        </p>
                      </div>
                      <div>
                        <div className="my-3 border-t-2 border-black" />
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="font-bold flex items-center gap-1.5">
                            <UsersRound size={14} /> Members
                          </span>
                          <span className="font-bold uppercase flex items-center gap-1">
                            Explore{" "}
                            <span className="transition-transform duration-300 group-hover:translate-x-1">
                              →
                            </span>
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="my-10 border-b-4 border-dashed border-black/20" />
            </div>
          )}

          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="font-mono text-xs font-black uppercase tracking-widest text-gray-600">
              {search ? `Results for "${search}"` : "All Clubs"}
            </h2>
            <div
              className="neu-border flex bg-white p-0.5"
              role="group"
              aria-label="Toggle club layout"
            >
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors duration-200 cursor-pointer ${
                  viewMode === "grid" ? "bg-black text-cream" : "bg-white text-black hover:bg-cream"
                }`}
              >
                <LayoutGrid size={14} /> Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                aria-pressed={viewMode === "list"}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors duration-200 cursor-pointer ${
                  viewMode === "list" ? "bg-black text-cream" : "bg-white text-black hover:bg-cream"
                }`}
              >
                <List size={14} /> List
              </button>
            </div>
          </div>

          {/* Main Directory List */}
          <div
            className={
              viewMode === "grid"
                ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3 transition-all duration-300"
                : "flex flex-col gap-3 transition-all duration-300"
            }
          >
            {isLoading ? (
              // Display a grid of exactly 6 skeleton cards for grid view, or 4 for list view
              viewMode === "grid" ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <ClubCardSkeleton key={`skeleton-${index}`} />
                ))
              ) : (
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="neu-border bg-white p-4 animate-pulse h-20 flex items-center gap-4"
                  >
                    <div className="h-12 w-12 shrink-0 bg-gray-200 rounded neu-border border-gray-300" />
                    <div className="flex-1">
                      <div className="h-5 bg-gray-200 w-1/3 rounded mb-2" />
                      <div className="h-3 bg-gray-200 w-2/3 rounded" />
                    </div>
                  </div>
                ))
              )
            ) : allClubs.length === 0 ? (
              <div className="neu-border col-span-full mx-auto flex w-full max-w-2xl flex-col items-center bg-white px-6 py-12 text-center md:px-12 md:py-16">
                <div className="neu-border mb-6 flex h-20 w-20 items-center justify-center bg-lime md:h-24 md:w-24">
                  <UsersRound className="h-10 w-10 md:h-12 md:w-12" aria-hidden="true" />
                </div>
                <p className="eyebrow font-bold text-black">Your campus community starts here</p>
                <h2 className="mt-2 text-3xl font-bold md:text-4xl">No clubs found</h2>
                <p className="mt-3 max-w-md font-mono text-sm leading-6 text-gray-700">
                  There are no clubs in the directory yet. Create the first club and bring students
                  with shared interests together.
                </p>
                <div className="mt-7">
                  <CreateClubDialog user={user} />
                </div>
              </div>
            ) : viewMode === "grid" ? (
              directoryClubs.map((c, index) => (
                <div
                  key={`${viewMode}-${c.slug}`}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${index * 75}ms` }}
                >
                  <Link
                    to={`/clubs/${c.slug}`}
                    className="neu-border group block bg-white p-6 shadow-[4px_4px_0_0_var(--color-ink)] transition-all duration-300 ease-in-out hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[8px_8px_0_0_var(--color-ink)] h-full"
                  >
                    <div
                      className={`club-logo-badge neu-border ${colors[index % colors.length]} mb-4 inline-block px-3 py-1 font-mono text-xs font-bold uppercase`}
                    >
                      Club
                    </div>
                    <h2 className="text-2xl font-bold">{c.name}</h2>
                    <div className="my-3 border-t-2 border-black" />
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span>Members</span>
                      <span className="font-bold uppercase flex items-center gap-1">
                        View{" "}
                        <span className="transition-transform duration-300 group-hover:translate-x-1">
                          →
                        </span>
                      </span>
                    </div>
                  </Link>
                </div>
              ))
            ) : (
              directoryClubs.map((c, index) => (
                <div
                  key={`${viewMode}-${c.slug}`}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <Link
                    to={`/clubs/${c.slug}`}
                    className="neu-border group flex items-center gap-4 bg-white p-4 shadow-[4px_4px_0_0_var(--color-ink)] transition-all duration-300 ease-in-out hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[8px_8px_0_0_var(--color-ink)]"
                  >
                    <div
                      className={`club-logo-badge neu-border ${colors[index % colors.length]} flex h-12 w-12 shrink-0 items-center justify-center`}
                    >
                      <UsersRound size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-bold">{c.name}</h2>
                      <p className="truncate font-mono text-xs text-gray-600">
                        {c.description || "No description provided."}
                      </p>
                    </div>
                    <span className="hidden shrink-0 items-center gap-1 font-mono text-xs font-bold uppercase sm:flex">
                      View{" "}
                      <span className="transition-transform duration-300 group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                  </Link>
                </div>
              ))
            )}

            {/* Next Page Fetching Skeleton Additions */}
            {isFetchingNextPage &&
              Array.from({ length: viewMode === "grid" ? 3 : 2 }).map((_, i) => (
                <div
                  key={`next-load-${i}`}
                  className={
                    viewMode === "grid"
                      ? "neu-border bg-white p-6 animate-pulse h-48 flex flex-col justify-between"
                      : "neu-border bg-white p-4 animate-pulse h-20 flex items-center gap-4"
                  }
                >
                  {viewMode === "grid" ? (
                    <>
                      <div>
                        <div className="h-6 bg-gray-200 w-16 mb-4 rounded neu-border border-gray-300" />
                        <div className="h-8 bg-gray-200 w-3/4 rounded" />
                      </div>
                      <div className="h-4 bg-gray-200 w-full mt-4 rounded" />
                    </>
                  ) : (
                    <>
                      <div className="h-12 w-12 shrink-0 bg-gray-200 rounded neu-border border-gray-300" />
                      <div className="flex-1">
                        <div className="h-5 bg-gray-200 w-1/3 rounded mb-2" />
                        <div className="h-3 bg-gray-200 w-2/3 rounded" />
                      </div>
                    </>
                  )}
                </div>
              ))}
          </div>

          {/* Load More Controller */}
          {hasNextPage && !search && (
            <div className="mt-12 flex justify-center">
              <button
                type="button"
                disabled={isFetchingNextPage}
                onClick={() => fetchNextPage()}
                className="neu-border neu-press bg-black px-6 py-3 font-mono text-sm font-bold uppercase text-cream hover:bg-cream hover:text-black transition-all disabled:opacity-50"
              >
                {isFetchingNextPage ? "Loading more..." : "Load More Clubs"}
              </button>
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
