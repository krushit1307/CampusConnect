import { describe, expect, it } from "vitest";

import {
  getHierarchyRoots,
  getHierarchyStats,
  normalizeClubHierarchy,
  type ClubHierarchyRow,
} from "./clubHierarchy";

const rows: ClubHierarchyRow[] = [
  {
    role_id: "president-role",
    user_id: "president",
    reports_to_user_id: null,
    full_name: "Ava President",
    handle: "ava",
    avatar_url: null,
    role_title: "President",
    department: null,
    depth: 0,
  },
  {
    role_id: "marketing-role",
    user_id: "marketing",
    reports_to_user_id: "president",
    full_name: "Mina Marketing",
    handle: "mina",
    avatar_url: null,
    role_title: "VP Marketing",
    department: null,
    depth: 1,
  },
  {
    role_id: "events-role",
    user_id: "events",
    reports_to_user_id: "marketing",
    full_name: "Eli Events",
    handle: "eli",
    avatar_url: null,
    role_title: "Events Director",
    department: null,
    depth: 2,
  },
];

describe("club hierarchy adapter", () => {
  it("converts member-based reporting lines into the existing recursive tree model", () => {
    const roots = getHierarchyRoots(rows);
    expect(roots).toHaveLength(1);
    expect(roots[0].title).toBe("President");
    expect(roots[0].children?.[0].user_id).toBe("marketing");
    expect(roots[0].children?.[0].children?.[0].user_id).toBe("events");
  });

  it("derives useful department labels without exposing private contact fields", () => {
    const [marketing] = normalizeClubHierarchy(rows).filter((node) => node.user_id === "marketing");
    expect(marketing.department).toBe("Marketing & Comms");
    expect(marketing.email).toBeUndefined();
  });

  it("detaches unknown managers to a safe top-level node and reports chart stats", () => {
    const result = getHierarchyStats([
      ...rows,
      { ...rows[2], role_id: "orphan-role", user_id: "orphan", reports_to_user_id: "missing" },
    ]);
    expect(result.rootCount).toBe(2);
    expect(result.maxDepth).toBe(3);
  });
});
