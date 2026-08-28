// src/lib/helpQueue.test.ts
// -----------------------------------------------------------------------------
// Unit tests for src/lib/helpQueue.ts (Issue #3938).
// Pure tests — no React, no Supabase.
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  isOpen, isClaimed, isClosed,
  getQueuePosition, ticketsAhead, estimateWaitMinutes, formatWaitTime,
  statusLabel, statusColor, buildMentorClaimedMessage,
  helpQueueChannelName, isTicketOwner, isAssignedMentor,
  type HelpTicket,
} from "./helpQueue";

function makeTicket(overrides: Partial<HelpTicket> = {}): HelpTicket {
  return {
    id: "ticket-1",
    event_id: "event-1",
    requested_by: "user-1",
    team_name: "Code Ninjas",
    table_number: "42",
    issue_description: "React app won't compile",
    status: "open",
    mentor_id: null,
    created_at: "2026-06-01T10:00:00.000Z",
    claimed_at: null,
    resolved_at: null,
    updated_at: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("isOpen / isClaimed / isClosed", () => {
  it("isOpen returns true for open tickets", () => {
    expect(isOpen(makeTicket({ status: "open" }))).toBe(true);
    expect(isOpen(makeTicket({ status: "claimed" }))).toBe(false);
  });

  it("isClaimed returns true for claimed tickets", () => {
    expect(isClaimed(makeTicket({ status: "claimed" }))).toBe(true);
    expect(isClaimed(makeTicket({ status: "open" }))).toBe(false);
  });

  it("isClosed returns true for resolved + cancelled", () => {
    expect(isClosed(makeTicket({ status: "resolved" }))).toBe(true);
    expect(isClosed(makeTicket({ status: "cancelled" }))).toBe(true);
    expect(isClosed(makeTicket({ status: "open" }))).toBe(false);
    expect(isClosed(makeTicket({ status: "claimed" }))).toBe(false);
  });
});

describe("getQueuePosition", () => {
  it("returns 0 when the ticket is not found", () => {
    expect(getQueuePosition([], "missing")).toBe(0);
  });

  it("returns 0 when the ticket is not open", () => {
    const t = makeTicket({ id: "t1", status: "claimed" });
    expect(getQueuePosition([t], "t1")).toBe(0);
  });

  it("returns 1 for the only open ticket", () => {
    const t = makeTicket({ id: "t1" });
    expect(getQueuePosition([t], "t1")).toBe(1);
  });

  it("returns position based on created_at order", () => {
    const t1 = makeTicket({ id: "t1", created_at: "2026-06-01T10:00:00Z" });
    const t2 = makeTicket({ id: "t2", created_at: "2026-06-01T10:05:00Z" });
    const t3 = makeTicket({ id: "t3", created_at: "2026-06-01T10:10:00Z" });
    const t4 = makeTicket({ id: "t4", status: "resolved", created_at: "2026-06-01T09:00:00Z" });
    expect(getQueuePosition([t4, t3, t2, t1], "t2")).toBe(2);
    expect(getQueuePosition([t4, t3, t2, t1], "t3")).toBe(3);
  });
});

describe("ticketsAhead", () => {
  it("returns 0 when position is 1 or 0", () => {
    expect(ticketsAhead([], "missing")).toBe(0);
    const t = makeTicket({ id: "t1" });
    expect(ticketsAhead([t], "t1")).toBe(0);
  });

  it("returns position - 1", () => {
    const t1 = makeTicket({ id: "t1", created_at: "2026-06-01T10:00:00Z" });
    const t2 = makeTicket({ id: "t2", created_at: "2026-06-01T10:05:00Z" });
    const t3 = makeTicket({ id: "t3", created_at: "2026-06-01T10:10:00Z" });
    expect(ticketsAhead([t1, t2, t3], "t3")).toBe(2);
  });
});

describe("estimateWaitMinutes", () => {
  it("returns 0 when no tickets ahead", () => {
    expect(estimateWaitMinutes(0)).toBe(0);
  });

  it("returns ticketsAhead * avgMinutesPerTicket (default 5)", () => {
    expect(estimateWaitMinutes(3)).toBe(15);
  });

  it("supports custom avgMinutesPerTicket", () => {
    expect(estimateWaitMinutes(4, 3)).toBe(12);
  });
});

describe("formatWaitTime", () => {
  it("returns 'Now' for 0 minutes", () => {
    expect(formatWaitTime(0)).toBe("Now");
  });

  it("returns '~N min' for sub-hour values", () => {
    expect(formatWaitTime(5)).toBe("~5 min");
    expect(formatWaitTime(15)).toBe("~15 min");
  });

  it("returns '~N hr' for exact hours", () => {
    expect(formatWaitTime(60)).toBe("~1 hr");
    expect(formatWaitTime(120)).toBe("~2 hr");
  });

  it("returns '~N hr M min' for mixed", () => {
    expect(formatWaitTime(80)).toBe("~1 hr 20 min");
  });
});

describe("statusLabel", () => {
  it("maps each status to its label", () => {
    expect(statusLabel("open")).toBe("In Queue");
    expect(statusLabel("claimed")).toBe("Mentor En Route");
    expect(statusLabel("resolved")).toBe("Resolved");
    expect(statusLabel("cancelled")).toBe("Cancelled");
  });
});

describe("statusColor", () => {
  it("returns a non-empty CSS class string for each status", () => {
    for (const s of ["open", "claimed", "resolved", "cancelled"] as const) {
      const cls = statusColor(s);
      expect(typeof cls).toBe("string");
      expect(cls.length).toBeGreaterThan(0);
      expect(cls).toContain("bg-");
    }
  });
});

describe("buildMentorClaimedMessage", () => {
  it("uses the mentor name when provided", () => {
    expect(buildMentorClaimedMessage("Alex", "42")).toBe(
      "Alex is on their way to Table 42!",
    );
  });

  it("falls back to 'A mentor' when name is null/undefined/empty", () => {
    expect(buildMentorClaimedMessage(null, "7")).toBe(
      "A mentor is on their way to Table 7!",
    );
    expect(buildMentorClaimedMessage(undefined, "7")).toBe(
      "A mentor is on their way to Table 7!",
    );
    expect(buildMentorClaimedMessage("", "7")).toBe(
      "A mentor is on their way to Table 7!",
    );
    expect(buildMentorClaimedMessage("   ", "7")).toBe(
      "A mentor is on their way to Table 7!",
    );
  });
});

describe("helpQueueChannelName", () => {
  it("returns the prefixed channel name", () => {
    expect(helpQueueChannelName("event-123")).toBe("help_queue_event_event-123");
  });
});

describe("isTicketOwner", () => {
  it("returns false for null userId", () => {
    expect(isTicketOwner(makeTicket(), null)).toBe(false);
  });

  it("returns true when userId matches requested_by", () => {
    expect(isTicketOwner(makeTicket({ requested_by: "u1" }), "u1")).toBe(true);
  });

  it("returns false when userId does not match", () => {
    expect(isTicketOwner(makeTicket({ requested_by: "u1" }), "u2")).toBe(false);
  });
});

describe("isAssignedMentor", () => {
  it("returns false when mentor_id is null", () => {
    expect(isAssignedMentor(makeTicket({ mentor_id: null }), "m1")).toBe(false);
  });

  it("returns false for null userId", () => {
    expect(isAssignedMentor(makeTicket({ mentor_id: "m1" }), null)).toBe(false);
  });

  it("returns true when userId matches mentor_id", () => {
    expect(isAssignedMentor(makeTicket({ mentor_id: "m1" }), "m1")).toBe(true);
  });

  it("returns false when userId does not match", () => {
    expect(isAssignedMentor(makeTicket({ mentor_id: "m1" }), "m2")).toBe(false);
  });
});
