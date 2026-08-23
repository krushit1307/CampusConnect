import { describe, it, expect } from "vitest";
import {
  buildOrgHierarchyTree,
  updateNodeReportsTo,
  calculateOrgStats,
  getDepartmentBadgeColor,
  ClubOrgNode,
} from "./clubOrgChart";

describe("Club Org Chart Hierarchy Utility (#3609)", () => {
  const sampleNodes: ClubOrgNode[] = [
    {
      id: "node-pres",
      club_id: "club-1",
      title: "President",
      name: "Alex Rivera",
      department: "Executive Board",
      reports_to_id: null,
    },
    {
      id: "node-vp-tech",
      club_id: "club-1",
      title: "VP of Technology",
      name: "Sam Chen",
      department: "Engineering",
      reports_to_id: "node-pres",
    },
    {
      id: "node-vp-mkt",
      club_id: "club-1",
      title: "VP of Marketing",
      name: "Taylor Swift",
      department: "Marketing",
      reports_to_id: "node-pres",
    },
    {
      id: "node-lead-frontend",
      club_id: "club-1",
      title: "Director of Frontend",
      name: "Jordan Lee",
      department: "Engineering",
      reports_to_id: "node-vp-tech",
    },
  ];

  it("builds multi-level nested org tree from flat nodes", () => {
    const tree = buildOrgHierarchyTree(sampleNodes);

    expect(tree).toHaveLength(1); // 1 root (President)
    const president = tree[0];
    expect(president.name).toBe("Alex Rivera");
    expect(president.children).toHaveLength(2); // VP Tech, VP Marketing

    const vpTech = president.children?.find((c) => c.id === "node-vp-tech");
    expect(vpTech?.children).toHaveLength(1); // Director of Frontend
    expect(vpTech?.children?.[0].name).toBe("Jordan Lee");
  });

  it("updates a node's reporting manager successfully", () => {
    // Reassign Director of Frontend to report directly to President
    const result = updateNodeReportsTo(sampleNodes, "node-lead-frontend", "node-pres");

    expect(result.success).toBe(true);
    const updated = result.updatedNodes.find((n) => n.id === "node-lead-frontend");
    expect(updated?.reports_to_id).toBe("node-pres");
  });

  it("prevents assigning a node to report to itself", () => {
    const result = updateNodeReportsTo(sampleNodes, "node-pres", "node-pres");

    expect(result.success).toBe(false);
    expect(result.error).toContain("cannot report to itself");
  });

  it("detects and prevents circular hierarchy loops", () => {
    // President cannot report to Director of Frontend who reports to VP Tech who reports to President
    const result = updateNodeReportsTo(sampleNodes, "node-pres", "node-lead-frontend");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Circular hierarchy detected");
  });

  it("calculates org governance statistics including tree depth and department counts", () => {
    const stats = calculateOrgStats(sampleNodes);

    expect(stats.totalMembers).toBe(4);
    expect(stats.totalDepartments).toBe(3); // Executive Board, Engineering, Marketing
    expect(stats.maxHierarchyDepth).toBe(3); // Level 1 (President) -> Level 2 (VP) -> Level 3 (Director)
    expect(stats.departments).toContain("Engineering");
  });

  it("returns styling tokens for departments", () => {
    expect(getDepartmentBadgeColor("Executive Board").bgClass).toContain("purple");
    expect(getDepartmentBadgeColor("Engineering").bgClass).toContain("sky");
    expect(getDepartmentBadgeColor("Marketing").bgClass).toContain("fuchsia");
  });
});
