import { useMemo } from "react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { canRole, type ClubPermission, type ClubRoleLevel } from "@/lib/clubPermissions";

export interface ClubRoleInfo {
  /** Club role display title (e.g. "Admin", "Treasurer"). */
  title: string;
  /** Numeric authority level from club_roles.permissions_level. */
  permissionsLevel: number;
  permissions?: string[];
  id: string;
}

interface Result {
  /** The effective role level, or null when not a member. */
  roleLevel: ClubRoleLevel | null;
  role: ClubRoleInfo | null;
  isMember: boolean;
  isApproved: boolean;
  isLoading: boolean;
  /** True when the member holds a role with the requested capability. */
  can: (permission: ClubPermission) => boolean;
}

/**
 * Resolve a user's effective role inside a club and expose a `can()` helper
 * backed by the permission matrix in src/lib/clubPermissions.ts.
 *
 * Works against the dynamic-role schema (club_members.role_id → club_roles)
 * with a legacy fallback to the old `role` string column so both DB states
 * are handled gracefully.
 */
export function useClubPermissions(clubId: string | undefined, userId: string | undefined): Result {
  const supabase = createClient();

  const { data: member, isLoading } = useQuery({
    queryKey: ["club_permissions", clubId, userId],
    queryFn: async () => {
      if (!clubId || !userId) return null;

      const { data, error } = await supabase
        .from("club_members")
        .select(
          `
          id, status, user_id,
          club_roles (id, title, permissions_level, permissions),
          role_id
        `,
        )
        .eq("club_id", clubId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: Boolean(clubId && userId),
  });

  return useMemo(() => {
    const approved = member?.status === "approved";
    const roleId = member?.role_id as string | null;
    const joinedRole =
      ((member as Record<string, unknown> | null)?.["club_roles"] as
        ClubRoleInfo[] | ClubRoleInfo | null) ?? null;

    // Normalize club_roles result (PostgREST can return object or array depending on cardinality)
    const roleInfo: ClubRoleInfo | null = Array.isArray(joinedRole)
      ? (joinedRole[0] ?? null)
      : (joinedRole as ClubRoleInfo | null);

    // Legacy fallback: pre-migration rows carry a plain `role` string.
    const legacyLevel = legacyRoleToLevel((member as Record<string, unknown> | null)?.["role"]);

    const roleLevel = approved
      ? ((roleInfo?.permissionsLevel ?? legacyLevel ?? null) as ClubRoleLevel | null)
      : null;

    return {
      roleLevel,
      role: approved ? roleInfo : null,
      isMember: Boolean(member && approved),
      isApproved: approved,
      isLoading,
      can: (permission: ClubPermission) =>
        canRole(roleInfo ?? (legacyLevel ? { permissionsLevel: legacyLevel } : null), permission),
    };
  }, [member, isLoading]);
}

function legacyRoleToLevel(role: unknown): number | null {
  switch (role) {
    case "admin":
    case "owner":
      return 100;
    case "organizer":
      return 40;
    case "member":
    case "alumni":
      return 10;
    default:
      return null;
  }
}
