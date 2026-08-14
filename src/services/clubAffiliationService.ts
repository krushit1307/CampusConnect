// src/services/clubAffiliationService.ts
import { createClient } from "@/lib/supabase/client";
import { ClubAffiliation, isExecutiveRole } from "@/types/clubAffiliation";

const affiliationCache = new Map<string, { data: ClubAffiliation[]; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache

export class ClubAffiliationService {
  private static getSupabase() {
    return createClient();
  }

  /**
   * Fetch active, verified club executive affiliations for a given user.
   */
  static async getUserAffiliations(userId: string): Promise<ClubAffiliation[]> {
    if (!userId) return [];

    // Check cache
    const cached = affiliationCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const supabase = this.getSupabase();

    // 1. Try RPC function get_user_club_affiliations
    try {
      const { data, error } = await supabase.rpc("get_user_club_affiliations", {
        p_user_id: userId,
      });

      if (!error && Array.isArray(data)) {
        const affiliations: ClubAffiliation[] = data.map((row: any) => ({
          club_id: row.club_id,
          club_name: row.club_name,
          club_slug: row.club_slug,
          club_logo_url: row.club_logo_url,
          role_name: row.role_name,
        }));

        affiliationCache.set(userId, { data: affiliations, timestamp: Date.now() });
        return affiliations;
      }
    } catch (e) {
      console.warn("RPC get_user_club_affiliations call failed, falling back to direct join query:", e);
    }

    // 2. Direct join query fallback: club_members -> clubs + club_roles
    try {
      const { data, error } = await supabase
        .from("club_members")
        .select(`
          status,
          clubs (id, name, slug, logo_url),
          club_roles (id, name)
        `)
        .eq("user_id", userId)
        .eq("status", "approved");

      if (error || !data) {
        console.error("Failed to query user club affiliations:", error);
        return [];
      }

      const affiliations: ClubAffiliation[] = [];

      for (const row of data as any[]) {
        const club = row.clubs;
        const role = row.club_roles;

        if (club && role && isExecutiveRole(role.name)) {
          affiliations.push({
            club_id: club.id,
            club_name: club.name,
            club_slug: club.slug,
            club_logo_url: club.logo_url,
            role_name: role.name,
          });
        }
      }

      affiliationCache.set(userId, { data: affiliations, timestamp: Date.now() });
      return affiliations;
    } catch (err) {
      console.error("Error in getUserAffiliations fallback:", err);
      return [];
    }
  }

  /**
   * Clear cache for a specific user (e.g. after role change or leave).
   */
  static clearCache(userId?: string) {
    if (userId) {
      affiliationCache.delete(userId);
    } else {
      affiliationCache.clear();
    }
  }
}
