import { buildOrgHierarchyTree, type ClubOrgNode } from "./clubOrgChart";

export type ClubHierarchyRow = {
  role_id: string;
  user_id: string;
  reports_to_user_id: string | null;
  full_name: string;
  handle: string;
  avatar_url: string | null;
  role_title: string;
  department: string | null;
  depth: number;
};

export function getDepartmentForRole(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("president") || lower.includes("executive") || lower.includes("secretary"))
    return "Executive Board";
  if (lower.includes("market") || lower.includes("social") || lower.includes("commun"))
    return "Marketing & Comms";
  if (lower.includes("event") || lower.includes("outreach") || lower.includes("logistic"))
    return "Events & Outreach";
  if (lower.includes("finance") || lower.includes("treasurer") || lower.includes("sponsor"))
    return "Finance & Sponsorship";
  if (lower.includes("tech") || lower.includes("engineer") || lower.includes("developer"))
    return "Technology";
  return "Committee";
}

export function normalizeClubHierarchy(rows: ClubHierarchyRow[]): ClubOrgNode[] {
  const validRows = rows.filter(
    (row) => row.role_id && row.user_id && row.full_name && row.role_title,
  );
  const userIds = new Set(validRows.map((row) => row.user_id));
  return validRows.map(
    (row) =>
      ({
        id: row.role_id,
        club_id: "",
        title: row.role_title,
        name: row.full_name,
        department: row.department || getDepartmentForRole(row.role_title),
        reports_to_id:
          row.reports_to_user_id && userIds.has(row.reports_to_user_id)
            ? (validRows.find((candidate) => candidate.user_id === row.reports_to_user_id)
                ?.role_id ?? null)
            : null,
        avatar_url: row.avatar_url || undefined,
        order_index: row.depth,
        user_id: row.user_id,
        handle: row.handle,
      }) as ClubOrgNode & { user_id: string; handle: string },
  );
}

export function getHierarchyRoots(rows: ClubHierarchyRow[]): ClubOrgNode[] {
  return buildOrgHierarchyTree(normalizeClubHierarchy(rows));
}

export function getHierarchyStats(rows: ClubHierarchyRow[]) {
  const nodes = normalizeClubHierarchy(rows);
  const tree = buildOrgHierarchyTree(nodes);
  const getDepth = (node: ClubOrgNode): number =>
    1 + Math.max(0, ...(node.children ?? []).map(getDepth));
  return {
    roleCount: nodes.length,
    rootCount: tree.length,
    maxDepth: tree.length ? Math.max(...tree.map(getDepth)) : 0,
  };
}
