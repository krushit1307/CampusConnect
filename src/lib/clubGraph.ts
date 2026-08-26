export interface RawClubRecord {
  id: string;
  name: string;
  category: string;
  parentClubId?: string | null;
}

export interface GraphNode {
  id: string;
  label: string;
  category: string;
  color: string;
}

export interface GraphLink {
  source: string; // Parent Club ID
  target: string; // Child Club ID
}

export interface ClubGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export const CATEGORY_COLOR_MAP: Record<string, string> = {
  Academic: "#3b82f6", // Blue
  Sports: "#ef4444", // Red
  Cultural: "#ec4899", // Pink
  Governance: "#8b5cf6", // Purple
  Default: "#6b7280", // Gray
};

/**
 * Maps raw database club records into { nodes, links } structure for force graph visualization.
 */
export function buildClubGraphData(clubs: RawClubRecord[]): ClubGraphData {
  const nodes: GraphNode[] = clubs.map((club) => ({
    id: club.id,
    label: club.name,
    category: club.category,
    color: CATEGORY_COLOR_MAP[club.category] || CATEGORY_COLOR_MAP.Default,
  }));

  const links: GraphLink[] = [];

  for (const club of clubs) {
    if (club.parentClubId) {
      links.push({
        source: club.parentClubId,
        target: club.id,
      });
    }
  }

  return { nodes, links };
}

/**
 * Checks in-memory list for circular dependency cycles before performing database operations.
 */
export function detectsCircularDependency(
  clubs: RawClubRecord[],
  targetClubId: string,
  proposedParentId: string,
): boolean {
  if (targetClubId === proposedParentId) return true;

  const parentMap = new Map<string, string | null>();
  for (const c of clubs) {
    parentMap.set(c.id, c.parentClubId || null);
  }

  // Set proposed parent
  parentMap.set(targetClubId, proposedParentId);

  let current: string | null | undefined = proposedParentId;
  const visited = new Set<string>();

  while (current) {
    if (current === targetClubId || visited.has(current)) {
      return true; // Cycle detected
    }
    visited.add(current);
    current = parentMap.get(current);
  }

  return false;
}

/**
 * Finds all direct parents and children connected to a selected node.
 */
export function getConnectedNeighborIds(
  links: GraphLink[],
  selectedNodeId: string,
): { parents: string[]; children: string[] } {
  const parents: string[] = [];
  const children: string[] = [];

  for (const link of links) {
    if (link.target === selectedNodeId) {
      parents.push(link.source);
    } else if (link.source === selectedNodeId) {
      children.push(link.target);
    }
  }

  return { parents, children };
}
