export interface ClubOrgNode {
  id: string;
  club_id: string;
  title: string;
  name: string;
  department?: string;
  reports_to_id?: string | null;
  bio?: string;
  email?: string;
  avatar_url?: string;
  user_id?: string;
  handle?: string;
  order_index?: number;
  children?: ClubOrgNode[];
}

export interface OrgHierarchyStats {
  totalMembers: number;
  totalDepartments: number;
  maxHierarchyDepth: number;
  departments: string[];
}

/**
 * Returns aesthetic badge styling for club governance departments (#3609).
 */
export function getDepartmentBadgeColor(department: string = "Executive"): {
  bgClass: string;
  borderClass: string;
  textClass: string;
} {
  const d = department.toLowerCase();
  if (d.includes("exec") || d.includes("presid")) {
    return {
      bgClass: "bg-purple-100",
      borderClass: "border-purple-400",
      textClass: "text-purple-950",
    };
  }
  if (d.includes("market") || d.includes("comm") || d.includes("social")) {
    return {
      bgClass: "bg-fuchsia-100",
      borderClass: "border-fuchsia-400",
      textClass: "text-fuchsia-950",
    };
  }
  if (d.includes("tech") || d.includes("dev") || d.includes("eng")) {
    return { bgClass: "bg-sky-100", borderClass: "border-sky-400", textClass: "text-sky-950" };
  }
  if (d.includes("finan") || d.includes("treasur") || d.includes("sponsor")) {
    return {
      bgClass: "bg-amber-100",
      borderClass: "border-amber-400",
      textClass: "text-amber-950",
    };
  }
  if (d.includes("event") || d.includes("logist") || d.includes("operat")) {
    return {
      bgClass: "bg-emerald-100",
      borderClass: "border-emerald-400",
      textClass: "text-emerald-950",
    };
  }
  return { bgClass: "bg-slate-100", borderClass: "border-slate-300", textClass: "text-slate-900" };
}

/**
 * Builds nested tree hierarchy from flat list of club org nodes (#3609).
 */
export function buildOrgHierarchyTree(nodes: ClubOrgNode[]): ClubOrgNode[] {
  if (!nodes || nodes.length === 0) return [];

  // Deep clone and prepare map with empty children arrays
  const nodeMap = new Map<string, ClubOrgNode>();
  nodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  const roots: ClubOrgNode[] = [];

  nodes.forEach((node) => {
    const current = nodeMap.get(node.id)!;
    if (node.reports_to_id && nodeMap.has(node.reports_to_id)) {
      const parent = nodeMap.get(node.reports_to_id)!;
      if (!parent.children) parent.children = [];
      parent.children.push(current);
    } else {
      // Root level node (e.g. President)
      roots.push(current);
    }
  });

  // Sort children by order_index or title
  const sortRecursive = (list: ClubOrgNode[]) => {
    list.sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.title.localeCompare(b.title),
    );
    list.forEach((item) => {
      if (item.children && item.children.length > 0) {
        sortRecursive(item.children);
      }
    });
  };

  sortRecursive(roots);
  return roots;
}

/**
 * Recursively gets all descendant node IDs to prevent circular hierarchy loops (#3609).
 */
export function getAllDescendantIds(nodes: ClubOrgNode[], parentId: string): Set<string> {
  const tree = buildOrgHierarchyTree(nodes);
  const descendants = new Set<string>();

  const findAndCollect = (node: ClubOrgNode, isTargetBranch: boolean) => {
    const isMatch = node.id === parentId || isTargetBranch;
    if (isMatch && node.id !== parentId) {
      descendants.add(node.id);
    }

    if (node.children) {
      node.children.forEach((child) => findAndCollect(child, isMatch));
    }
  };

  tree.forEach((root) => findAndCollect(root, false));
  return descendants;
}

/**
 * Updates a node's reporting manager while preventing circular dependencies (#3609).
 */
export function updateNodeReportsTo(
  nodes: ClubOrgNode[],
  nodeId: string,
  newReportsToId: string | null,
): { updatedNodes: ClubOrgNode[]; success: boolean; error?: string } {
  if (nodeId === newReportsToId) {
    return {
      updatedNodes: nodes,
      success: false,
      error: "A role cannot report to itself.",
    };
  }

  if (newReportsToId) {
    const descendants = getAllDescendantIds(nodes, nodeId);
    if (descendants.has(newReportsToId)) {
      return {
        updatedNodes: nodes,
        success: false,
        error: "Circular hierarchy detected: cannot report to a role that reports to this node.",
      };
    }
  }

  const updatedNodes = nodes.map((node) =>
    node.id === nodeId ? { ...node, reports_to_id: newReportsToId } : node,
  );

  return {
    updatedNodes,
    success: true,
  };
}

/**
 * Computes hierarchy metrics and department counts (#3609).
 */
export function calculateOrgStats(nodes: ClubOrgNode[]): OrgHierarchyStats {
  if (!nodes || nodes.length === 0) {
    return {
      totalMembers: 0,
      totalDepartments: 0,
      maxHierarchyDepth: 0,
      departments: [],
    };
  }

  const departmentsSet = new Set<string>();
  nodes.forEach((n) => {
    if (n.department) departmentsSet.add(n.department.trim());
  });

  const tree = buildOrgHierarchyTree(nodes);

  const getDepth = (node: ClubOrgNode): number => {
    if (!node.children || node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(getDepth));
  };

  const maxHierarchyDepth = tree.length > 0 ? Math.max(...tree.map(getDepth)) : 0;

  return {
    totalMembers: nodes.length,
    totalDepartments: departmentsSet.size,
    maxHierarchyDepth,
    departments: Array.from(departmentsSet),
  };
}
