import { createClient } from "@/lib/supabase/client";

export interface BlockedUser {
  blocked_id: string;
  first_name?: string | null;
  last_name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
  college?: string | null;
  created_at: string;
}

export interface GenericContentItem {
  id: string;
  author_id?: string | null;
  sender_id?: string | null;
  receiver_id?: string | null;
  profiles?: { id: string } | { id: string }[] | null;
}

// In-memory materializer cache for high performance & low db overhead
let cachedBlockedIds: Set<string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 1 minute TTL

/**
 * Reset in-memory cache (used on block/unblock actions or test resets)
 */
export function invalidateUserBlocksCache(): void {
  cachedBlockedIds = null;
  cacheTimestamp = 0;
}

/**
 * Fetch blocked user IDs for the authenticated user, utilizing in-memory cache
 */
export async function getBlockedUserIds(
  currentUserId: string,
  forceRefresh = false,
): Promise<Set<string>> {
  const now = Date.now();
  if (!forceRefresh && cachedBlockedIds && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedBlockedIds;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", currentUserId);

  if (error) {
    console.error("Error fetching blocked user list:", error);
    return cachedBlockedIds || new Set();
  }

  const blockedSet = new Set((data || []).map((row) => row.blocked_id));
  cachedBlockedIds = blockedSet;
  cacheTimestamp = now;

  return blockedSet;
}

/**
 * Fetch full profile details of blocked users for Settings management
 */
export async function getBlockedUsersList(currentUserId: string): Promise<BlockedUser[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_blocked_users", { p_user_id: currentUserId });

  if (error) {
    // Fallback if RPC is not available yet
    const { data: rawBlocks, error: rawError } = await supabase
      .from("user_blocks")
      .select(
        `
        blocked_id,
        created_at,
        profiles:blocked_id (first_name, last_name, handle, avatar_url, college)
      `,
      )
      .eq("blocker_id", currentUserId);

    if (rawError || !rawBlocks) return [];

    return rawBlocks.map((b: Record<string, unknown>) => {
      const prof = (Array.isArray(b.profiles) ? b.profiles[0] : b.profiles) as Record<
        string,
        string
      > | null;
      return {
        blocked_id: b.blocked_id as string,
        first_name: prof?.first_name || null,
        last_name: prof?.last_name || null,
        handle: prof?.handle || null,
        avatar_url: prof?.avatar_url || null,
        college: prof?.college || null,
        created_at: b.created_at as string,
      };
    });
  }

  return (data || []) as BlockedUser[];
}

/**
 * Block a target user by ID
 */
export async function blockUser(
  currentUserId: string,
  targetUserId: string,
): Promise<{ success: boolean; error?: string }> {
  if (currentUserId === targetUserId) {
    return { success: false, error: "You cannot block yourself." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("user_blocks").insert({
    blocker_id: currentUserId,
    blocked_id: targetUserId,
  });

  if (error) {
    if (error.code === "23505") {
      // Unique violation
      return { success: true };
    }
    return { success: false, error: error.message };
  }

  invalidateUserBlocksCache();
  return { success: true };
}

/**
 * Unblock a target user by ID
 */
export async function unblockUser(
  currentUserId: string,
  targetUserId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", currentUserId)
    .eq("blocked_id", targetUserId);

  if (error) {
    return { success: false, error: error.message };
  }

  invalidateUserBlocksCache();
  return { success: true };
}

/**
 * Check if target user is blocked by current user
 */
export function isUserBlocked(blockedSet: Set<string>, targetUserId: string): boolean {
  if (!targetUserId) return false;
  return blockedSet.has(targetUserId);
}

/**
 * Filter list of items (posts, events, etc.) excluding those created by blocked users
 */
export function filterBlockedContent<T extends GenericContentItem>(
  items: T[],
  blockedSet: Set<string>,
): T[] {
  if (!blockedSet || blockedSet.size === 0) return items;

  return items.filter((item) => {
    // Check author_id
    if (item.author_id && blockedSet.has(item.author_id)) {
      return false;
    }

    // Check sender_id
    if (item.sender_id && blockedSet.has(item.sender_id)) {
      return false;
    }

    // Check profiles relation author
    if (item.profiles) {
      const profileId = Array.isArray(item.profiles) ? item.profiles[0]?.id : item.profiles.id;
      if (profileId && blockedSet.has(profileId)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Validate direct message send capability between two users
 */
export async function validateDirectMessageSend(
  senderId: string,
  receiverId: string,
): Promise<{ allowed: boolean; status: number; error?: string }> {
  if (senderId === receiverId) {
    return { allowed: true, status: 200 };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(
      `and(blocker_id.eq.${receiverId},blocked_id.eq.${senderId}),and(blocker_id.eq.${senderId},blocked_id.eq.${receiverId})`,
    );

  if (error) {
    console.error("Error validating direct message block relationship:", error);
  }

  if (data && data.length > 0) {
    return {
      allowed: false,
      status: 403,
      error: "403 Forbidden: Messaging is unavailable due to block settings.",
    };
  }

  return { allowed: true, status: 200 };
}
