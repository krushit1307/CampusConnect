import { SupabaseClient } from "@supabase/supabase-js";

export interface SharedClub {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  description?: string | null;
  category?: string | null;
}

/**
 * Calls the `get_shared_clubs` Postgres RPC function to fetch common approved club memberships
 * between userA and userB using INNER JOIN on the club_members table.
 */
export async function getSharedClubs(
  supabase: SupabaseClient,
  userAId: string,
  userBId: string,
): Promise<SharedClub[]> {
  if (!userAId || !userBId || userAId === userBId) {
    return [];
  }

  const { data, error } = await supabase.rpc("get_shared_clubs", {
    user_a: userAId,
    user_b: userBId,
  });

  if (error) {
    console.error("Failed to fetch shared clubs RPC:", error);
    throw new Error(`Failed to fetch shared clubs: ${error.message}`);
  }

  return data || [];
}
