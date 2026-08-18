import { describe, it, expect } from "vitest";
import {
  canRole,
  legacyRoleToLevel,
  roleTitleForLevel,
  CLUB_ROLE_PERMISSIONS,
} from "./clubPermissions";

describe("CLUB_ROLE_PERMISSIONS", () => {
  it("defines the expected capability ladder", () => {
    expect(CLUB_ROLE_PERMISSIONS["members.view"]).toBe(10);
    expect(CLUB_ROLE_PERMISSIONS["events.create"]).toBe(40);
    expect(CLUB_ROLE_PERMISSIONS["budget.read"]).toBe(60);
    expect(CLUB_ROLE_PERMISSIONS["club.manage"]).toBe(100);
  });
});

describe("canRole", () => {
  it("denies permission when no role is present", () => {
    expect(canRole(null, "members.view")).toBe(false);
    expect(canRole(undefined, "members.view")).toBe(false);
  });

  it("allows roles at or above the required level", () => {
    expect(canRole(100, "club.manage")).toBe(true);
    expect(canRole(100, "members.manage")).toBe(true);
    expect(canRole(60, "budget.read")).toBe(true);
    expect(canRole(40, "events.create")).toBe(true);
  });

  it("denies roles below the required level", () => {
    expect(canRole(10, "events.create")).toBe(false);
    expect(canRole(10, "club.manage")).toBe(false);
    expect(canRole(40, "club.manage")).toBe(false);
    expect(canRole(60, "roles.assign")).toBe(false);
  });

  it("inherits lower-level permissions from higher-level roles", () => {
    expect(canRole(100, "members.view")).toBe(true);
    expect(canRole(100, "events.create")).toBe(true);
    expect(canRole(60, "events.create")).toBe(true);
  });
});

describe("legacyRoleToLevel", () => {
  it("maps legacy admin/owner to full control", () => {
    expect(legacyRoleToLevel("admin")).toBe(100);
    expect(legacyRoleToLevel("owner")).toBe(100);
  });

  it("maps organizer to 40", () => {
    expect(legacyRoleToLevel("organizer")).toBe(40);
  });

  it("maps member/alumni to 10", () => {
    expect(legacyRoleToLevel("member")).toBe(10);
    expect(legacyRoleToLevel("alumni")).toBe(10);
  });

  it("returns null for unknown roles", () => {
    expect(legacyRoleToLevel("anything-else")).toBe(null);
    expect(legacyRoleToLevel(undefined)).toBe(null);
  });
});

describe("roleTitleForLevel", () => {
  it("resolves built-in role titles by level", () => {
    expect(roleTitleForLevel(10)).toBe("Member");
    expect(roleTitleForLevel(40)).toBe("Organizer");
    expect(roleTitleForLevel(60)).toBe("Treasurer");
    expect(roleTitleForLevel(100)).toBe("Admin");
  });

  it("falls back to Member for unknown levels", () => {
    expect(roleTitleForLevel(0)).toBe("Member");
    expect(roleTitleForLevel(55)).toBe("Member");
  });
});
