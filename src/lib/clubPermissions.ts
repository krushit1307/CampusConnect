// ── Club Role Permission Matrix (single source of truth) ──────────────────
// Mirrors the DB model in supabase/migrations/20260720000006_dynamic_club_roles.sql
// where club_roles.permissions_level is the numeric authority ladder:
//
//   Member  -> 10     (read-only)
//   Organizer -> 40   (can publish content + events)
//   Treasurer -> 60   (budget + analytics)
//   Admin    -> 100   (full control incl. member/role management)
//
// Capabilities are integers on the same ladder so a role with a higher level
// automatically inherits every permission below it. Keeping one matrix here
// means UI gating and server-side checks share the exact same vocabulary.

export const CLUB_ROLE_PERMISSIONS = {
  "members.view": "View club info, members, and events.",
  "content.view": "Read the club's public content feed.",
  "events.create": "Create club events.",
  "content.publish": "Edit/publish posts on the club feed.",
  "budget.read": "Read budget/voting records.",
  "analytics.view": "View club analytics dashboards.",
  "members.manage": "Approve/reject pending members.",
  "roles.assign": "Assign club roles to members.",
  "club.manage": "Edit club settings.",
} as const;

export type ClubPermission = keyof typeof CLUB_ROLE_PERMISSIONS;

export type ClubRoleLevel = 10 | 40 | 60 | 100;

export interface ClubRoleData {
  permissionsLevel: number;
  permissions?: string[];
}

/** Built-in roles seeded per club by the migration. */
export const BUILTIN_ROLES = {
  MEMBER: { title: "Member", permissionsLevel: 10 },
  ORGANIZER: { title: "Organizer", permissionsLevel: 40 },
  TREASURER: { title: "Treasurer", permissionsLevel: 60 },
  ADMIN: { title: "Admin", permissionsLevel: 100 },
} as const;

const ROLE_TITLES_BY_LEVEL: Partial<Record<ClubRoleLevel, string>> = {
  10: BUILTIN_ROLES.MEMBER.title,
  40: BUILTIN_ROLES.ORGANIZER.title,
  60: BUILTIN_ROLES.TREASURER.title,
  100: BUILTIN_ROLES.ADMIN.title,
};

export function roleTitleForLevel(level: number): string {
  return ROLE_TITLES_BY_LEVEL[level as ClubRoleLevel] ?? "Member";
}

export function canRole(
  role: ClubRoleData | null | undefined,
  permission: ClubPermission,
): boolean {
  if (!role) return false;
  if (role.permissionsLevel >= 100) return true;
  return Array.isArray(role.permissions) && role.permissions.includes(permission);
}

/** Maps the legacy pre-migration `club_members.role` string to an authority level. */
export function legacyRoleToLevel(role: unknown): number | null {
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
