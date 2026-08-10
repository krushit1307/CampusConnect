import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  cancelCarpool,
  claimCarpoolSeat,
  fetchCarpoolsForEvent,
  leaveCarpool,
  offerCarpool,
} from "./carpool";
import { supabase } from "./client";

vi.mock("./client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const carpoolsRow = {
  id: "cp-1",
  event_id: "evt-1",
  driver_id: "u-1",
  capacity: 4,
  departure_time: "2026-09-01T10:00:00Z",
  meeting_point: "North Gate",
  notes: null,
  status: "active",
  created_at: "2026-08-09T10:00:00Z",
  updated_at: "2026-08-09T10:00:00Z",
  driver: { full_name: "Alex Driver", avatar_url: null },
  carpool_passengers: [{ count: 2 }],
};

/**
 * Builds a chainable PostgREST builder. The query for `carpools` resolves when
 * `.order(...)` is reached, and the query for the current user's passenger rows
 * resolves when `.eq("passenger_id", ...)` is reached.
 */
function makeChain(carpoolsResult: unknown, passengersResult: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn((column: string) => {
      if (column === "passenger_id") return Promise.resolve(passengersResult);
      return chain;
    }),
    in: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(carpoolsResult)),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchCarpoolsForEvent", () => {
  it("returns carpools enriched with driver, passenger count and my seat", async () => {
    vi.mocked(supabase.from).mockImplementation(() =>
      makeChain(
        { data: [carpoolsRow], error: null },
        { data: [{ id: "pass-1", carpool_id: "cp-1" }], error: null },
      ),
    );

    const { data, error } = await fetchCarpoolsForEvent("evt-1", "u-2");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({
      id: "cp-1",
      driver: { full_name: "Alex Driver" },
      passenger_count: 2,
      my_passenger_id: "pass-1",
    });
    expect(supabase.from).toHaveBeenCalledWith("carpools");
    expect(supabase.from).toHaveBeenCalledWith("carpool_passengers");
  });

  it("marks my_passenger_id as null when the user has no seat", async () => {
    vi.mocked(supabase.from).mockImplementation(() =>
      makeChain({ data: [carpoolsRow], error: null }, { data: [], error: null }),
    );

    const { data } = await fetchCarpoolsForEvent("evt-1", "u-2");

    expect(data?.[0].my_passenger_id).toBeNull();
    expect(data?.[0].passenger_count).toBe(2);
  });

  it("skips the passenger lookup when no user is signed in", async () => {
    vi.mocked(supabase.from).mockImplementation(() =>
      makeChain({ data: [carpoolsRow], error: null }, null),
    );

    const { data } = await fetchCarpoolsForEvent("evt-1", null);

    expect(data?.[0].my_passenger_id).toBeNull();
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("returns error when the carpool query fails", async () => {
    const mockError = { message: "Network error", code: "500", details: "", hint: "" };
    vi.mocked(supabase.from).mockImplementation(() =>
      makeChain({ data: null, error: mockError }, null),
    );

    const { data, error } = await fetchCarpoolsForEvent("evt-1", null);

    expect(data).toBeNull();
    expect(error).toEqual(mockError);
  });
});

describe("offerCarpool", () => {
  it("calls the offer_carpool RPC with the right arguments", async () => {
    const rpcResult = { success: true, code: "OFFERED", message: "ok", carpool_id: "cp-1" };
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: rpcResult, error: null });

    const { data, error } = await offerCarpool("evt-1", {
      capacity: 3,
      departureTime: "2026-09-01T10:00:00.000Z",
      meetingPoint: "Library steps",
      notes: "Leaving early",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("offer_carpool", {
      p_event_id: "evt-1",
      p_capacity: 3,
      p_departure_time: "2026-09-01T10:00:00.000Z",
      p_meeting_point: "Library steps",
      p_notes: "Leaving early",
    });
    expect(error).toBeNull();
    expect(data).toEqual(rpcResult);
  });
});

describe("claimCarpoolSeat", () => {
  it("calls the claim_carpool_seat RPC", async () => {
    const rpcResult = { success: true, code: "CLAIMED", message: "Seat claimed" };
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: rpcResult, error: null });

    const { data, error } = await claimCarpoolSeat("cp-1");

    expect(supabase.rpc).toHaveBeenCalledWith("claim_carpool_seat", { p_carpool_id: "cp-1" });
    expect(error).toBeNull();
    expect(data).toEqual(rpcResult);
  });

  it("surfaces RPC failures as errors", async () => {
    const mockError = { message: "RPC failed", code: "500", details: "", hint: "" };
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: mockError });

    const { data, error } = await claimCarpoolSeat("cp-1");

    expect(data).toBeNull();
    expect(error).toEqual(mockError);
  });
});

describe("leaveCarpool", () => {
  it("calls the leave_carpool RPC", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true, code: "LEFT", message: "You left the carpool" },
      error: null,
    });

    const { data } = await leaveCarpool("cp-1");

    expect(supabase.rpc).toHaveBeenCalledWith("leave_carpool", { p_carpool_id: "cp-1" });
    expect(data?.success).toBe(true);
  });
});

describe("cancelCarpool", () => {
  it("calls the cancel_carpool RPC", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { success: true, code: "CANCELLED", message: "Carpool cancelled", notified: 2 },
      error: null,
    });

    const { data } = await cancelCarpool("cp-1");

    expect(supabase.rpc).toHaveBeenCalledWith("cancel_carpool", { p_carpool_id: "cp-1" });
    expect(data).toMatchObject({ success: true, notified: 2 });
  });
});
