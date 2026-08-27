import { describe, it, expect } from "vitest";
import { PERMISSIONS, hasPermission, addPermission, removePermission } from "./permissions";

describe("Bitmask Authorization Suite (#2202)", () => {
  it("correctly evaluates permissions for mask = 5 (CREATE_EVENT + MANAGE_USERS)", () => {
    // Seed mask = 5 (1 + 4)
    const userMask = PERMISSIONS.CREATE_EVENT | PERMISSIONS.MANAGE_USERS;
    expect(userMask).toBe(5);

    // Verify CREATE_EVENT (1) -> TRUE
    expect(hasPermission(userMask, PERMISSIONS.CREATE_EVENT)).toBe(true);

    // Verify MANAGE_USERS (4) -> TRUE
    expect(hasPermission(userMask, PERMISSIONS.MANAGE_USERS)).toBe(true);

    // Verify DELETE_EVENT (2) -> FALSE
    expect(hasPermission(userMask, PERMISSIONS.DELETE_EVENT)).toBe(false);
  });

  it("grants DELETE_EVENT via bitwise OR (mask = 5 | 2 => 7)", () => {
    let mask = 5; // 1 + 4
    expect(hasPermission(mask, PERMISSIONS.DELETE_EVENT)).toBe(false);

    // Grant DELETE_EVENT (2)
    mask = addPermission(mask, PERMISSIONS.DELETE_EVENT);
    expect(mask).toBe(7); // 1 + 2 + 4 = 7

    // Verify DELETE_EVENT is now granted
    expect(hasPermission(mask, PERMISSIONS.DELETE_EVENT)).toBe(true);
  });

  it("revokes MANAGE_USERS via bitwise AND NOT (mask = 7 & ~4 => 3)", () => {
    let mask = 7; // 1 + 2 + 4
    mask = removePermission(mask, PERMISSIONS.MANAGE_USERS);

    expect(mask).toBe(3); // 1 + 2 = 3
    expect(hasPermission(mask, PERMISSIONS.MANAGE_USERS)).toBe(false);
    expect(hasPermission(mask, PERMISSIONS.CREATE_EVENT)).toBe(true);
  });
});
