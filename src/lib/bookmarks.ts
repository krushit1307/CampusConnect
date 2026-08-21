import { createClient } from "@/lib/supabase/client";

export type BookmarkType = "event" | "post" | "club";

export interface Bookmark {
  id: string;
  user_id: string;
  event_id: string | null;
  post_id: string | null;
  club_id: string | null;
  created_at: string;
  events: { id: string; title: string; event_date: string | null } | null;
  posts: { id: string; content: string; created_at: string } | null;
  clubs: { id: string; name: string; slug: string } | null;
}

export async function fetchBookmarks(userId: string): Promise<Bookmark[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bookmarks")
    .select(
      `id, user_id, event_id, post_id, club_id, created_at,
       events (id, title, event_date),
       posts (id, content, created_at),
       clubs (id, name, slug)`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Bookmark[];
}

export async function toggleBookmark(
  userId: string,
  type: BookmarkType,
  targetId: string,
  isBookmarked: boolean,
): Promise<void> {
  const supabase = createClient();
  const col = `${type}_id` as "event_id" | "post_id" | "club_id";

  if (isBookmarked) {
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .match({ user_id: userId, [col]: targetId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("bookmarks").insert({ user_id: userId, [col]: targetId });
    if (error) throw error;
  }
}

// Legacy helpers kept for backward compat with saved_events usage
export interface SavedEventRelation<TEvent> {
  id: string;
  user_id: string;
  event: TEvent | TEvent[] | null;
}

export function normalizeSavedEvent<TEvent>(
  relation: SavedEventRelation<TEvent>,
): (TEvent & { saved_events: { id: string; user_id: string }[] }) | null {
  const rawEvent = relation.event;
  if (!rawEvent) return null;
  const event = Array.isArray(rawEvent) ? rawEvent[0] : rawEvent;
  if (!event) return null;
  return { ...event, saved_events: [{ id: relation.id, user_id: relation.user_id }] };
}

export function normalizeSavedEvents<TEvent>(
  relations: SavedEventRelation<TEvent>[],
): (TEvent & { saved_events: { id: string; user_id: string }[] })[] {
  return relations
    .map(normalizeSavedEvent)
    .filter((e): e is TEvent & { saved_events: { id: string; user_id: string }[] } => e !== null);
}
