import { describe, expect, it } from "vitest";
import { buildPresenceMap, getPresenceBadgeClass, getPresenceStatus } from "./usePresence";

describe("usePresence helpers", () => {
  it("maps presence payloads into a user status index", () => {
    const now = new Date().toISOString();
    const state = buildPresenceMap({
      alice: [{ userId: "alice", status: "online", lastSeen: now }],
      bob: [{ userId: "bob", status: "idle", lastSeen: now }],
    });

    expect(state.alice.status).toBe("online");
    expect(state.bob.status).toBe("idle");
  });

  it("returns the correct indicator class for each status", () => {
    expect(getPresenceBadgeClass("online")).toContain("bg-emerald-500");
    expect(getPresenceBadgeClass("idle")).toContain("bg-amber-500");
    expect(getPresenceBadgeClass("offline")).toContain("bg-gray-400");
  });

  it("infers online, idle, and offline states from recency", () => {
    const now = Date.now();

    expect(getPresenceStatus(new Date(now - 30_000).toISOString())).toBe("online");
    expect(getPresenceStatus(new Date(now - 2 * 60_000).toISOString())).toBe("idle");
    expect(getPresenceStatus(new Date(now - 10 * 60_000).toISOString())).toBe("offline");
  });
});
