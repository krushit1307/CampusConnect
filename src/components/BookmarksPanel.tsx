import { Bookmark, X, CalendarDays, MessageSquare, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { fetchBookmarks, toggleBookmark, type Bookmark as BM } from "@/lib/bookmarks";
import type { User } from "@supabase/supabase-js";

interface BookmarksPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function BookmarksPanel({ open, onOpenChange, user }: BookmarksPanelProps) {
  const [bookmarks, setBookmarks] = useState<BM[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setBookmarks(await fetchBookmarks(user.id));
    } catch {
      toast.error("Failed to load bookmarks.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Realtime sync
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`bookmarks-panel-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookmarks", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [user, load]);

  const handleRemove = async (bm: BM) => {
    if (!user) return;
    const type = bm.event_id ? "event" : bm.post_id ? "post" : "club";
    const targetId = (bm.event_id ?? bm.post_id ?? bm.club_id)!;

    // Optimistic remove
    setRemoving(bm.id);
    setBookmarks((prev) => prev.filter((b) => b.id !== bm.id));

    try {
      await toggleBookmark(user.id, type, targetId, true);
      toast.success("Bookmark removed.");
    } catch {
      toast.error("Failed to remove bookmark.");
      void load(); // revert
    } finally {
      setRemoving(null);
    }
  };

  const events = bookmarks.filter((b) => b.event_id);
  const posts = bookmarks.filter((b) => b.post_id);
  const clubs = bookmarks.filter((b) => b.club_id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2 font-display text-xl font-black uppercase">
            <Bookmark className="h-5 w-5" fill="currentColor" />
            Saved Items
          </SheetTitle>
        </SheetHeader>

        {!user ? (
          <p className="font-mono text-sm text-gray-500">Sign in to view your bookmarks.</p>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="neu-border h-16 animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Bookmark className="h-12 w-12 text-gray-300" />
            <p className="font-mono text-sm font-bold uppercase text-gray-500">Nothing saved yet</p>
            <p className="text-xs text-gray-400">
              Bookmark events, posts, and clubs to find them here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {events.length > 0 && (
              <Section
                icon={<CalendarDays className="h-4 w-4" />}
                title="Events"
                count={events.length}
              >
                {events.map((bm) => (
                  <BookmarkItem
                    key={bm.id}
                    label={bm.events?.title ?? "Event"}
                    sub={
                      bm.events?.event_date
                        ? new Date(bm.events.event_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "TBA"
                    }
                    href={`/events/${bm.event_id}`}
                    onRemove={() => handleRemove(bm)}
                    removing={removing === bm.id}
                    onClose={() => onOpenChange(false)}
                  />
                ))}
              </Section>
            )}

            {posts.length > 0 && (
              <Section
                icon={<MessageSquare className="h-4 w-4" />}
                title="Posts"
                count={posts.length}
              >
                {posts.map((bm) => (
                  <BookmarkItem
                    key={bm.id}
                    label={(bm.posts?.content ?? "").slice(0, 80) + "…"}
                    sub={
                      bm.posts?.created_at
                        ? new Date(bm.posts.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : ""
                    }
                    href={`/feed#post-${bm.post_id}`}
                    onRemove={() => handleRemove(bm)}
                    removing={removing === bm.id}
                    onClose={() => onOpenChange(false)}
                  />
                ))}
              </Section>
            )}

            {clubs.length > 0 && (
              <Section icon={<Users className="h-4 w-4" />} title="Clubs" count={clubs.length}>
                {clubs.map((bm) => (
                  <BookmarkItem
                    key={bm.id}
                    label={bm.clubs?.name ?? "Club"}
                    sub={`/clubs/${bm.clubs?.slug ?? ""}`}
                    href={`/clubs/${bm.clubs?.slug}`}
                    onRemove={() => handleRemove(bm)}
                    removing={removing === bm.id}
                    onClose={() => onOpenChange(false)}
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-gray-500">
        {icon}
        {title}
        <span className="ml-auto rounded-full bg-black px-1.5 py-0.5 text-[10px] text-white">
          {count}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function BookmarkItem({
  label,
  sub,
  href,
  onRemove,
  removing,
  onClose,
}: {
  label: string;
  sub: string;
  href: string;
  onRemove: () => void;
  removing: boolean;
  onClose: () => void;
}) {
  return (
    <div className="neu-border flex items-center gap-3 bg-white p-3">
      <Link to={href} onClick={onClose} className="min-w-0 flex-1 hover:underline">
        <p className="truncate font-mono text-sm font-bold">{label}</p>
        <p className="truncate font-mono text-xs text-gray-500">{sub}</p>
      </Link>
      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        aria-label="Remove bookmark"
        className="neu-border grid h-7 w-7 shrink-0 place-items-center bg-white transition-colors hover:bg-peach disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
