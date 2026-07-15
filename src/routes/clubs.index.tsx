import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Plus, UsersRound, X } from "lucide-react";

export const Route = createFileRoute("/clubs/")({
  head: () => ({
    meta: [
      { title: "Club directory — CampusConnect" },
      {
        name: "description",
        content: "Discover student clubs, tech communities, and societies on your campus.",
      },
    ],
  }),
  component: ClubsIndex,
});

function ClubsIndex() {
  const supabase = createClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);
  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ["clubs"],
    queryFn: async () => {
      const { data } = await supabase.from("clubs").select(`
        id, name, slug, description,
        club_members (id)
      `);
      return data || [];
    },
  });

  const colors = ["bg-lime", "bg-sky", "bg-lavender", "bg-peach"];
  const filteredClubs = clubs.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || "").toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreateClub = () => {
    window.alert("Club creation is coming soon!");
  };

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-lavender px-4 py-14 md:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow font-bold">Club directory · {clubs.length} active</p>
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
      </section>

      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full py-10 font-mono">Loading clubs...</div>
          ) : clubs.length === 0 ? (
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
              <button
                type="button"
                onClick={handleCreateClub}
                className="neu-border neu-press mt-7 inline-flex items-center gap-2 bg-sky px-5 py-3 font-mono text-sm font-bold uppercase"
              >
                <Plus size={18} aria-hidden="true" />
                Create a Club
              </button>
            </div>
          ) : (
            filteredClubs.map((c, index) => {
              const members = Array.isArray(c.club_members) ? c.club_members.length : 0;
              return (
                <Link
                  key={c.slug}
                  to="/clubs/$slug"
                  params={{ slug: c.slug }}
                  className="neu-border group block bg-white p-6 shadow-[4px_4px_0_0_#000] transition-all duration-300 ease-in-out hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[8px_8px_0_0_#000]"
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
              );
            })
          )}
        </div>
      </section>
    </SiteShell>
  );
}
