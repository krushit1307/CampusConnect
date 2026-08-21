export interface ClubOrgMember {
  id: string;
  role_id: string;
  role_title: string;
  reports_to_role_id: string | null;
  user_id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
}

export interface ClubOrgRole {
  id: string;
  title: string;
  reports_to_role_id: string | null;
}

export interface ClubOrgTree {
  roots: string[];
  childrenByRole: Record<string, string[]>;
  membersByRole: Record<string, ClubOrgMember[]>;
  cycleRoleIds: string[];
  orphanRoleIds: string[];
}

export function buildClubOrgTree(roles: ClubOrgRole[], members: ClubOrgMember[]): ClubOrgTree {
  const roleIds = new Set(roles.map((role) => role.id));
  const parentByRole = new Map(roles.map((role) => [role.id, role.reports_to_role_id] as const));
  const childrenByRole: Record<string, string[]> = {};
  const cycleRoleIds = new Set<string>();
  const orphanRoleIds = new Set<string>();

  for (const role of roles) childrenByRole[role.id] = [];

  for (const role of roles) {
    const parentId = role.reports_to_role_id;
    if (!parentId) continue;
    if (!roleIds.has(parentId)) {
      orphanRoleIds.add(role.id);
      continue;
    }
    childrenByRole[parentId].push(role.id);
  }

  for (const role of roles) {
    const path = new Set<string>();
    let current: string | null = role.id;
    while (current) {
      if (path.has(current)) {
        cycleRoleIds.add(current);
        cycleRoleIds.add(role.id);
        break;
      }
      path.add(current);
      current = parentByRole.get(current) ?? null;
    }
  }

  const membersByRole: Record<string, ClubOrgMember[]> = {};
  for (const member of members) {
    if (!membersByRole[member.role_id]) membersByRole[member.role_id] = [];
    membersByRole[member.role_id].push(member);
  }

  const roots = roles
    .filter(
      (role) => !role.reports_to_role_id || orphanRoleIds.has(role.id) || cycleRoleIds.has(role.id),
    )
    .map((role) => role.id);

  return {
    roots,
    childrenByRole,
    membersByRole,
    cycleRoleIds: [...cycleRoleIds],
    orphanRoleIds: [...orphanRoleIds],
  };
}
