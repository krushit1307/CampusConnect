import { useEffect, useState, useCallback, useMemo } from "react";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import UserX from "lucide-react/dist/esm/icons/user-x";
import Unlock from "lucide-react/dist/esm/icons/unlock";
import Search from "lucide-react/dist/esm/icons/search";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import { toast } from "sonner";
import {
  getBlockedUsersList,
  unblockUser,
  blockUser,
  type BlockedUser,
} from "@/lib/userBlockUtils";
import { createClient } from "@/lib/supabase/client";

interface ProfileSearchResult {
  id: string;
  first_name: string | null;
  last_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  college: string | null;
}

interface BlockedUsersPanelProps {
  currentUserId: string;
}

export function BlockedUsersPanel({ currentUserId }: BlockedUsersPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  // Manual block user search state
  const [searchHandle, setSearchHandle] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ProfileSearchResult[]>([]);
  const [blockingId, setBlockingId] = useState<string | null>(null);

  const fetchBlockedList = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const list = await getBlockedUsersList(currentUserId);
      setBlockedUsers(list);
    } catch (err) {
      console.error("Failed to load blocked users:", err);
      toast.error("Failed to load blocked users list.");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchBlockedList();
  }, [fetchBlockedList]);

  const handleUnblock = async (blockedId: string, name: string) => {
    setUnblockingId(blockedId);
    try {
      const res = await unblockUser(currentUserId, blockedId);
      if (res.success) {
        setBlockedUsers((prev) => prev.filter((u) => u.blocked_id !== blockedId));
        toast.success(`Unblocked ${name || "user"} successfully.`);
      } else {
        toast.error(res.error || "Failed to unblock user.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while unblocking user.");
    } finally {
      setUnblockingId(null);
    }
  };

  const handleSearchUserToBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchHandle.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    try {
      const query = searchHandle.trim().replace(/^@/, "");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, handle, avatar_url, college")
        .neq("id", currentUserId)
        .or(`handle.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
      if (!data || data.length === 0) {
        toast.info("No matching accounts found to block.");
      }
    } catch (err) {
      console.error("Error searching profiles:", err);
      toast.error("Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleBlockNewUser = async (target: ProfileSearchResult) => {
    const fullName =
      `${target.first_name || ""} ${target.last_name || ""}`.trim() || target.handle || "User";
    setBlockingId(target.id);
    try {
      const res = await blockUser(currentUserId, target.id);
      if (res.success) {
        toast.success(`Blocked ${fullName}. Content from this account is now filtered.`);
        setSearchHandle("");
        setSearchResults([]);
        fetchBlockedList();
      } else {
        toast.error(res.error || "Failed to block user.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while blocking user.");
    } finally {
      setBlockingId(null);
    }
  };

  const filteredBlockedUsers = blockedUsers.filter((u) => {
    const name = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
    const handle = (u.handle || "").toLowerCase();
    const query = filterQuery.toLowerCase();
    return name.includes(query) || handle.includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="border-2 border-black bg-[#fffae5] p-4 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 border-2 border-black bg-[#ff4757] p-2 text-white">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className="font-display text-base font-extrabold uppercase tracking-wide">
              Server-Side Block & Privacy Controls
            </h3>
            <p className="mt-1 font-mono text-xs text-gray-700">
              Accounts in your block list are filtered at the server level. Their posts will be
              hidden from your global feed and comments, and direct message exchanges with blocked
              users are rejected with a 403 Forbidden status.
            </p>
          </div>
        </div>
      </div>

      {/* Block new account search form */}
      <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h4 className="font-display text-sm font-bold uppercase text-black mb-2 flex items-center gap-2">
          <UserX size={16} className="text-red-500" />
          Block a New User
        </h4>
        <form onSubmit={handleSearchUserToBlock} className="flex gap-2">
          <input
            type="text"
            value={searchHandle}
            onChange={(e) => setSearchHandle(e.target.value)}
            placeholder="Search by handle (@username) or name..."
            className="flex-1 border-2 border-black px-3 py-1.5 font-mono text-xs focus:outline-none focus:bg-lime/30"
          />
          <button
            type="submit"
            disabled={isSearching || !searchHandle.trim()}
            className="neu-border neu-press flex items-center gap-1.5 bg-black px-4 py-1.5 font-mono text-xs font-bold uppercase text-white disabled:opacity-50"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="mt-3 divide-y-2 divide-black border-2 border-black bg-slate-50">
            {searchResults.map((user) => {
              const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "User";
              const isAlreadyBlocked = blockedUsers.some((b) => b.blocked_id === user.id);

              return (
                <div key={user.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="font-display text-xs font-bold uppercase text-black">
                      {fullName}
                    </p>
                    <p className="font-mono text-[10px] text-gray-600">
                      @{user.handle || "no_handle"} {user.college ? `• ${user.college}` : ""}
                    </p>
                  </div>
                  {isAlreadyBlocked ? (
                    <span className="flex items-center gap-1 font-mono text-xs font-bold text-gray-500 uppercase">
                      <CheckCircle2 size={14} /> Already Blocked
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleBlockNewUser(user)}
                      disabled={blockingId === user.id}
                      className="neu-border neu-press bg-red-600 px-3 py-1 font-mono text-xs font-bold uppercase text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {blockingId === user.id ? "Blocking..." : "Block"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Blocked accounts list */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="font-display text-sm font-bold uppercase text-black">
            Blocked Accounts ({blockedUsers.length})
          </h4>
          {blockedUsers.length > 0 && (
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-gray-500" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter list..."
                className="border-2 border-black bg-white py-1 pl-8 pr-2 font-mono text-xs focus:outline-none"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center border-2 border-black bg-white p-8 font-mono text-xs">
            <Loader2 size={16} className="animate-spin mr-2" /> Loading blocked accounts list...
          </div>
        ) : filteredBlockedUsers.length === 0 ? (
          <div className="border-2 border-black bg-white p-8 text-center font-mono text-xs text-gray-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {blockedUsers.length === 0
              ? "You currently have no blocked users."
              : "No blocked users match your filter query."}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredBlockedUsers.map((user) => {
              const fullName =
                `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Blocked User";
              const dateStr = user.created_at
                ? new Date(user.created_at).toLocaleDateString()
                : "Recently";

              return (
                <div
                  key={user.blocked_id}
                  className="flex items-center justify-between border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5"
                >
                  <div className="flex items-center gap-3">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={fullName}
                        className="h-10 w-10 border-2 border-black object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-red-100 font-display text-sm font-bold uppercase text-red-600">
                        {fullName[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-display text-xs font-bold uppercase text-black">
                        {fullName}
                      </p>
                      <p className="font-mono text-[10px] text-gray-600">
                        @{user.handle || "no_handle"} • Blocked {dateStr}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnblock(user.blocked_id, fullName)}
                    disabled={unblockingId === user.blocked_id}
                    className="neu-border neu-press flex items-center gap-1 bg-lime px-3 py-1 font-mono text-xs font-bold uppercase text-black transition-all hover:bg-black hover:text-white disabled:opacity-50"
                  >
                    {unblockingId === user.blocked_id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Unlock size={12} />
                    )}
                    Unblock
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
