import { createClient } from "@/lib/supabase/client";

/**
 * Buddy Matcher data access (#2728).
 *
 * All matching logic lives in Postgres RPCs (`find_buddy_matches`,
 * `send_buddy_wave`, `respond_buddy_wave`) so similarity search stays inside
 * pgvector and personal rows stay protected by RLS. This module is a thin,
 * typed wrapper over those calls.
 */

export interface BuddyMatcherProfile {
  user_id: string;
  bio: string;
  embedding_stale: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BuddyMatch {
  user_id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  bio: string;
  /** Cosine similarity between TF-IDF embeddings (0..1). */
  similarity: number;
  shared_categories: string[];
}

export interface IncomingWave {
  id: string;
  created_at: string;
  sender: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    handle: string | null;
  };
}

export type BuddyResult<T> = { success: true; data: T } | { success: false; error: string };

/** Fetch the signed-in user's opt-in row (null when not opted in). */
export async function getMyBuddyProfile(): Promise<BuddyMatcherProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("buddy_matcher_profiles")
    .select("user_id, bio, embedding_stale, is_active, created_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as BuddyMatcherProfile | null) ?? null;
}

/** Opt in to the matching pool with a brief bio. Embedding builds on demand. */
export async function optInToBuddyMatching(bio: string): Promise<BuddyResult<BuddyMatcherProfile>> {
  const trimmed = bio.trim();
  if (trimmed.length < 10) {
    return { success: false, error: "Please write at least 10 characters so buddies know you." };
  }
  if (trimmed.length > 280) {
    return { success: false, error: "Keep your bio under 280 characters." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You need to be signed in." };

  const { data, error } = await supabase
    .from("buddy_matcher_profiles")
    .upsert({ user_id: user.id, bio: trimmed, is_active: true })
    .select("user_id, bio, embedding_stale, is_active, created_at, updated_at")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as BuddyMatcherProfile };
}

/**
 * Instantly leave the matching pool. The row is deactivated (kept for a fast
 * re-opt-in) unless `deleteRow` is set, which also wipes the stored embedding.
 */
export async function optOutOfBuddyMatching(deleteRow = false): Promise<BuddyResult<null>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You need to be signed in." };

  const { error } = deleteRow
    ? await supabase.from("buddy_matcher_profiles").delete().eq("user_id", user.id)
    : await supabase
        .from("buddy_matcher_profiles")
        .update({ is_active: false })
        .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

/**
 * KNN search over the opted-in pool via the pgvector cosine-distance RPC.
 * Returns up to five mathematically-similar buddies.
 */
export async function findBuddyMatches(limit = 5): Promise<BuddyMatch[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("find_buddy_matches", {
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as BuddyMatch[];
}

/** Send a wave 👋 to another opted-in student. */
export async function sendWave(receiverId: string): Promise<BuddyResult<{ wave_id: string }>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("send_buddy_wave", { p_receiver: receiverId });

  if (error) return { success: false, error: error.message };
  const payload = data as { success: boolean; error?: string; wave_id?: string };
  if (!payload?.success) return { success: false, error: payload?.error ?? "Wave failed." };
  return { success: true, data: { wave_id: payload.wave_id ?? "" } };
}

/** Accept or decline an incoming wave. Accepting unlocks the E2EE DM channel. */
export async function respondToWave(
  waveId: string,
  accept: boolean,
): Promise<BuddyResult<"accepted" | "declined">> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("respond_buddy_wave", {
    p_wave_id: waveId,
    p_accept: accept,
  });

  if (error) return { success: false, error: error.message };
  const payload = data as { success: boolean; error?: string; status?: string };
  if (!payload?.success) return { success: false, error: payload?.error ?? "Response failed." };
  return { success: true, data: (payload.status as "accepted" | "declined") ?? "declined" };
}

/** Pending waves waiting for the signed-in user's response. */
export async function getIncomingWaves(): Promise<IncomingWave[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("buddy_waves")
    .select(
      `id, created_at,
       sender:profiles!buddy_waves_sender_id_fkey (id, full_name, avatar_url, handle)`,
    )
    .eq("receiver_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    sender: row.sender as unknown as IncomingWave["sender"],
  }));
}
