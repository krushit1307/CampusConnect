import { describe, expect, it } from "vitest";
import { buildClubOrgTree } from "./clubOrgChart";

describe("club organization chart tree", () => {
  it("builds roots and children for a normal hierarchy", () => {
    const tree = buildClubOrgTree(
      [
        { id: "president", title: "President", reports_to_role_id: null },
        { id: "finance", title: "VP Finance", reports_to_role_id: "president" },
        { id: "treasurer", title: "Treasurer", reports_to_role_id: "finance" },
      ],
      [],
    );
    expect(tree.roots).toEqual(["president"]);
    expect(tree.childrenByRole.president).toEqual(["finance"]);
    expect(tree.childrenByRole.finance).toEqual(["treasurer"]);
    expect(tree.cycleRoleIds).toEqual([]);
  });

  it("detects cycles without infinite recursion", () => {
    const tree = buildClubOrgTree(
      [
        { id: "president", title: "President", reports_to_role_id: "treasurer" },
        { id: "treasurer", title: "Treasurer", reports_to_role_id: "president" },
      ],
      [],
    );
    expect(tree.cycleRoleIds.sort()).toEqual(["president", "treasurer"]);
    expect(tree.roots.sort()).toEqual(["president", "treasurer"]);
  });

  it("isolates roles whose parent was deleted", () => {
    const tree = buildClubOrgTree(
      [{ id: "events", title: "Events", reports_to_role_id: "missing" }],
      [],
    );
    expect(tree.orphanRoleIds).toEqual(["events"]);
    expect(tree.roots).toEqual(["events"]);
  });
});
