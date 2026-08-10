import { useMemo, useState, useEffect } from "react";
import { Search } from "lucide-react";
import { VirtualList } from "@/components/ui/VirtualList";
import { UserCard } from "@/components/Directory/UserCard";
import { generateMockUsers, filterUsers } from "@/components/Directory/userData";
import type { UserProfile } from "@/components/Directory/types";

export default function Directory() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const users = useMemo<UserProfile[]>(() => {
    if (loading) return [];
    return generateMockUsers();
  }, [loading]);

  const filteredUsers = useMemo(() => {
    return filterUsers(users, searchQuery);
  }, [searchQuery, users]);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">University User Directory</h1>
      <p className="text-muted-foreground mb-4">
        Rendering {filteredUsers.length.toLocaleString()} users efficiently using custom windowed
        virtualization.
      </p>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, major, or interests..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 py-6 text-lg w-full bg-background neu-border"
        />
      </div>

      <div className="border rounded-lg shadow-sm bg-card overflow-hidden">
        {loading ? (
          <div style={{ height: 600, overflow: "hidden" }}>
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="animate-pulse border-b h-[88px]" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">No people match that search</h3>
              <p className="text-muted-foreground">Try a different name, major, or interest.</p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-4 neu-border neu-press bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-white"
              >
                Clear search
              </button>
            </div>
          </div>
        ) : (
          <VirtualList
            items={filteredUsers}
            height={600}
            itemHeight={88}
            overscan={5}
            renderItem={(user) => <UserCard user={user} />}
          />
        )}
      </div>
    </div>
  );
}
