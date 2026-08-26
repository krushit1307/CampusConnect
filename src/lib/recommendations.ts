import { supabase } from "@/lib/supabaseClient";

/**
 * Represents a recommended club returned from the cosine similarity RPC.
 */
export interface RecommendedClub {
  club_id: string;
  club_name: string;
  club_description: string;
  similarity_score: number;
  is_cold_start: boolean;
}

/**
 * Fetches recommended clubs for a user based on their interest vector.
 *
 * @param userVector - An array of numbers representing the user's one-hot encoded interests.
 * @param limit - Maximum number of recommendations to return (default: 5).
 * @returns A promise resolving to an array of RecommendedClub objects.
 */
export async function getRecommendedClubs(
  userVector: number[] | null,
  limit: number = 5,
): Promise<RecommendedClub[]> {
  // If user has no interests, pass a zero-vector or null to trigger cold start fallback
  const vectorParam = userVector && userVector.length > 0 ? `[${userVector.join(",")}]` : null;

  const { data, error } = await supabase.rpc("get_recommended_clubs", {
    p_user_vector: vectorParam,
    p_limit: limit,
  });

  if (error) {
    console.error("Error fetching club recommendations:", error);
    throw new Error("Failed to fetch recommendations");
  }

  return (data as RecommendedClub[]) || [];
}

/**
 * Helper function to convert a list of user interest strings into a
 * one-hot encoded numeric vector based on a master tag list.
 *
 * @param userInterests - Array of interest strings (e.g., ['Coding', 'Gaming'])
 * @param masterTagList - Array of all possible tags in the system (ordered)
 * @returns A numeric array of 1s and 0s.
 */
export function encodeUserInterests(userInterests: string[], masterTagList: string[]): number[] {
  return masterTagList.map((tag) => (userInterests.includes(tag) ? 1 : 0));
}
