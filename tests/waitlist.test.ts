// tests/waitlist.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client before importing the module under test.
vi.mock("../src/lib/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from "../src/lib/supabase/client";
import { joinEventOrWaitlist, cancelEventRsvp, getEventRsvpState } from "../src/lib/waitlist";

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRpc.mockReset();
});

describe("waitlist — joinEventOrWaitlist", () => {
  it("returns attending when the RPC reports success+attending", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, status: "attending" },
      error: null,
    });
    const result = await joinEventOrWaitlist("evt-1", "usr-1");
    expect(result).toEqual({ success: true, status: "attending", message: undefined });
    expect(mockRpc).toHaveBeenCalledWith("join_event_or_waitlist", {
      p_event_id: "evt-1",
      p_user_id: "usr-1",
      p_resume_path: null,
    });
  });

  it("passes an optional resume path to events that require a resume", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, status: "attending" },
      error: null,
    });

    await joinEventOrWaitlist("evt-1", "usr-1", "resumes/usr-1.pdf");

    expect(mockRpc).toHaveBeenCalledWith("join_event_or_waitlist", {
      p_event_id: "evt-1",
      p_user_id: "usr-1",
      p_resume_path: "resumes/usr-1.pdf",
    });
  });

  it("returns waitlisted with position when the RPC reports waitlisted", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, status: "waitlisted", position: 3 },
      error: null,
    });
    const result = await joinEventOrWaitlist("evt-1", "usr-1");
    expect(result).toEqual({ success: true, status: "waitlisted", position: 3 });
  });

  it("returns error when the RPC returns an error", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Event not found." },
    });
    const result = await joinEventOrWaitlist("evt-1", "usr-1");
    expect(result).toEqual({ success: false, error: "Event not found." });
  });

  it("returns error when the RPC returns success=false", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error: "Event not found." },
      error: null,
    });
    const result = await joinEventOrWaitlist("evt-1", "usr-1");
    expect(result).toEqual({ success: false, error: "Event not found." });
  });
});

describe("waitlist — cancelEventRsvp", () => {
  it("returns success when the RPC cancels an attending RSVP", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        was_attending: true,
        message: "RSVP cancelled. Next waitlisted user will be promoted.",
      },
      error: null,
    });
    const result = await cancelEventRsvp("evt-1", "usr-1");
    expect(result).toEqual({
      success: true,
      wasAttending: true,
      message: "RSVP cancelled. Next waitlisted user will be promoted.",
    });
  });

  it("returns success when the RPC cancels a waitlisted RSVP", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        was_attending: false,
        message: "Waitlist entry removed.",
      },
      error: null,
    });
    const result = await cancelEventRsvp("evt-1", "usr-1");
    expect(result).toEqual({
      success: true,
      wasAttending: false,
      message: "Waitlist entry removed.",
    });
  });

  it("returns error when the RPC returns no active RSVP", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: false, error: "No active RSVP found for this event." },
      error: null,
    });
    const result = await cancelEventRsvp("evt-1", "usr-1");
    expect(result).toEqual({
      success: false,
      error: "No active RSVP found for this event.",
    });
  });
});

describe("waitlist — getEventRsvpState", () => {
  it("returns the parsed state when the RPC succeeds", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        max_attendees: 50,
        attending_count: 50,
        waitlist_count: 15,
        is_full: true,
        user_status: "waitlisted",
        user_waitlist_position: 7,
      },
      error: null,
    });
    const result = await getEventRsvpState("evt-1", "usr-1");
    expect(result).toEqual({
      max_attendees: 50,
      attending_count: 50,
      waitlist_count: 15,
      is_full: true,
      user_status: "waitlisted",
      user_waitlist_position: 7,
    });
  });

  it("returns null when the RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied" },
    });
    const result = await getEventRsvpState("evt-1", "usr-1");
    expect(result).toBeNull();
  });

  it("passes undefined user_id as null to the RPC", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        max_attendees: null,
        attending_count: 3,
        waitlist_count: 0,
        is_full: false,
        user_status: null,
        user_waitlist_position: null,
      },
      error: null,
    });
    await getEventRsvpState("evt-1");
    expect(mockRpc).toHaveBeenCalledWith("get_event_rsvp_state", {
      p_event_id: "evt-1",
      p_user_id: null,
    });
  });
});

describe("waitlist — race-condition safety (SQL contract)", () => {
  // These tests verify that the migration file contains the
  // critical race-condition-safety primitives specified in issue
  // #2693: SELECT FOR UPDATE on the events row, and SELECT FOR
  // UPDATE SKIP LOCKED on the waitlist row. We assert the SQL is
  // present so future refactors don't silently remove the
  // concurrency protection.
  it("the migration uses SELECT FOR UPDATE on the events row", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.resolve(
        __dirname,
        "../supabase/migrations/20260816000000_automated_waitlist_system.sql",
      ),
      "utf-8",
    );
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("FROM public.events");
  });

  it("the migration uses SELECT FOR UPDATE SKIP LOCKED for promotion", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.resolve(
        __dirname,
        "../supabase/migrations/20260816000000_automated_waitlist_system.sql",
      ),
      "utf-8",
    );
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
  });

  it("the migration adds a status column with the waitlisted enum value", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.resolve(
        __dirname,
        "../supabase/migrations/20260816000000_automated_waitlist_system.sql",
      ),
      "utf-8",
    );
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS status");
    expect(sql).toContain("'waitlisted'");
    expect(sql).toContain("'attending'");
    expect(sql).toContain("'cancelled'");
  });

  it("the migration invokes pg_net for the email webhook", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.resolve(
        __dirname,
        "../supabase/migrations/20260816000000_automated_waitlist_system.sql",
      ),
      "utf-8",
    );
    expect(sql).toContain("extensions.net.http_post");
    expect(sql).toContain("waitlist-promotion-email");
  });
});
