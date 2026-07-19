import { Link } from "react-router-dom";

import { useEffect, useRef, useState } from "react";

import { SiteShell } from "@/components/site/SiteShell";
import { useInfiniteQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { Plus, UsersRound, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { CreateClubDialog } from "@/components/CreateClubDialog";

const ITEMS_PER_PAGE = 12;

export default function ClubsIndex() {
  const supabase = createClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);

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
          .select(`id, name, slug, description, member_count`, { count: "exact" })
          .eq("status", "approved")
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
      `}</style>
      <section className="border-b-2 border-black bg-lavender px-4 py-14 md:px-6">
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
                className="neu-border w-full bg-white px-4 py-3 pr-10 font-mono text-sm outline-none"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              // Initial Page Loader Skeletons
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="neu-border bg-white p-6 animate-pulse h-48 flex flex-col justify-between"
                >
                  <div>
                    <div className="h-6 bg-gray-200 w-16 mb-4 rounded neu-border border-gray-300" />
                    <div className="h-8 bg-gray-200 w-3/4 rounded" />
                  </div>
                  <div className="h-4 bg-gray-200 w-full mt-4 rounded" />
                </div>
              ))
            ) : allClubs.length === 0 ? (
              <div className="neu-border col-span-full mx-auto flex w-full max-w-2xl flex-col items-center bg-white px-6 py-12 text-center md:px-12 md:py-16">
                <div className="neu-border mb-6 flex h-20 w-20 items-center justify-center bg-lime md:h-24 md:w-24">
                  <UsersRound className="h-10 w-10 md:h-12 md:w-12" aria-hidden="true" />
                </div>
                <p className="eyebrow font-bold">Your campus community starts here</p>
                <h2 className="mt-2 text-3xl font-bold md:text-4xl">No clubs found</h2>
                <p className="mt-3 max-w-md font-mono text-sm leading-6 text-gray-700">
                  There are no clubs in the directory yet. Create the first club and bring students
                  with shared interests together.
                </p>
                <div className="mt-7">
                  <CreateClubDialog user={user} />
                </div>
              </div>
            ) : (
              filteredClubs.map((c, index) => {
                const members = c.member_count ?? 0;
                return (
                  <div
                    key={c.slug}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${index * 75}ms` }}
                  >
                    <Link
                      to={`/clubs/${c.slug}`}
                      className="neu-border group block bg-white p-6 shadow-[4px_4px_0_0_#000] transition-all duration-300 ease-in-out hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[8px_8px_0_0_#000] h-full"
                    >
                      <div
                        className={`neu-border ${colors[index % colors.length]} mb-4 inline-block px-3 py-1 font-mono text-xs font-bold uppercase`}
                      >
                        Club
                      </div>
                      <h2 className="text-2xl font-bold">{c.name}</h2>
                      <div className="my-3 border-t-2 border-black" />
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span>{members} members</span>
                        <span className="font-bold uppercase flex items-center gap-1">
                          View{" "}
                          <span className="transition-transform duration-300 group-hover:translate-x-1">
                            →
                          </span>
                        </span>
                      </div>
                    </Link>
                  </div>
                );
              })
            )}

            {/* Next Page Fetching Skeleton Additions */}
            {isFetchingNextPage &&
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={`next-load-${i}`}
                  className="neu-border bg-white p-6 animate-pulse h-48 flex flex-col justify-between"
                >
                  <div>
                    <div className="h-6 bg-gray-200 w-16 mb-4 rounded neu-border border-gray-300" />
                    <div className="h-8 bg-gray-200 w-3/4 rounded" />
                  </div>
                  <div className="h-4 bg-gray-200 w-full mt-4 rounded" />
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
