import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { CarpoolSection } from "./CarpoolSection";
import {
  cancelCarpool,
  claimCarpoolSeat,
  fetchCarpoolsForEvent,
  leaveCarpool,
  offerCarpool,
  type CarpoolWithDetails,
} from "@/lib/supabase/carpool";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: () => ({
        on: () => ({
          subscribe: vi.fn(),
        }),
      }),
    }),
    removeChannel: vi.fn(),
  }),
}));

vi.mock("@/lib/supabase/carpool", () => ({
  fetchCarpoolsForEvent: vi.fn(),
  offerCarpool: vi.fn(),
  claimCarpoolSeat: vi.fn(),
  leaveCarpool: vi.fn(),
  cancelCarpool: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedFetch = vi.mocked(fetchCarpoolsForEvent);
const mockedOffer = vi.mocked(offerCarpool);
const mockedClaim = vi.mocked(claimCarpoolSeat);
const mockedLeave = vi.mocked(leaveCarpool);
const mockedCancel = vi.mocked(cancelCarpool);

const signedOutUser = null;
const signedInUser = { id: "u-2", email: "rider@campus.edu" } as unknown as User;
const driverUser = { id: "u-1", email: "driver@campus.edu" } as unknown as User;

const activeCarpool: CarpoolWithDetails = {
  id: "cp-1",
  event_id: "evt-1",
  driver_id: "u-1",
  capacity: 4,
  departure_time: "2026-09-01T10:00:00Z",
  meeting_point: "North Gate",
  notes: "Leaving early",
  status: "active",
  created_at: "2026-08-09T10:00:00Z",
  updated_at: "2026-08-09T10:00:00Z",
  driver: { full_name: "Alex Driver", avatar_url: null },
  passenger_count: 2,
  my_passenger_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CarpoolSection", () => {
  it("renders loading skeletons then the offered rides", async () => {
    mockedFetch.mockResolvedValue({ data: [activeCarpool], error: null });

    render(<CarpoolSection eventId="evt-1" user={signedOutUser} />);

    expect(screen.getByText("Loading rides...")).toBeInTheDocument();

    expect(await screen.findByText("Alex Driver")).toBeInTheDocument();
    expect(screen.getByText("2/4 seats filled")).toBeInTheDocument();
    expect(screen.getByText("North Gate")).toBeInTheDocument();
    expect(screen.getByText("1 ride offered")).toBeInTheDocument();
  });

  it("pluralises the offered-rides count", async () => {
    mockedFetch.mockResolvedValue({
      data: [activeCarpool, { ...activeCarpool, id: "cp-2" }],
      error: null,
    });

    render(<CarpoolSection eventId="evt-1" user={signedOutUser} />);

    expect(await screen.findByText("2 rides offered")).toBeInTheDocument();
  });

  it("shows the signed-out empty state", async () => {
    mockedFetch.mockResolvedValue({ data: [], error: null });

    render(<CarpoolSection eventId="evt-1" user={signedOutUser} />);

    expect(await screen.findByText(/No rides offered yet\./)).toBeInTheDocument();
    expect(screen.getByText("Sign in to offer a ride or claim a seat.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /offer a ride/i })).not.toBeInTheDocument();
  });

  it("invites a signed-in user to offer the first ride", async () => {
    mockedFetch.mockResolvedValue({ data: [], error: null });

    render(<CarpoolSection eventId="evt-1" user={signedInUser} />);

    expect(
      await screen.findByText(/No rides offered yet — be the first to offer a ride!/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /offer a ride/i })).toBeInTheDocument();
  });

  it("falls back to the empty state when loading fails", async () => {
    mockedFetch.mockResolvedValue({ data: null, error: new Error("Network error") });

    render(<CarpoolSection eventId="evt-1" user={signedOutUser} />);

    expect(await screen.findByText(/No rides offered yet\./)).toBeInTheDocument();
  });

  it("submits the offer form and shows the success toast", async () => {
    mockedFetch.mockResolvedValue({ data: [], error: null });
    mockedOffer.mockResolvedValue({
      data: { success: true, code: "OFFERED", message: "ok" },
      error: null,
    });

    render(<CarpoolSection eventId="evt-1" user={signedInUser} />);
    await screen.findByText(/No rides offered yet/);

    fireEvent.click(screen.getByRole("button", { name: /offer a ride/i }));
    fireEvent.change(screen.getByLabelText("Departure time"), {
      target: { value: "2026-09-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText("Meeting point"), {
      target: { value: " Library steps " },
    });
    fireEvent.change(screen.getByLabelText("Notes (optional)"), {
      target: { value: "Gas money appreciated" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^offer ride$/i }));

    await waitFor(() =>
      expect(mockedOffer).toHaveBeenCalledWith("evt-1", {
        capacity: 4,
        departureTime: new Date("2026-09-01T10:00").toISOString(),
        meetingPoint: "Library steps",
        notes: "Gas money appreciated",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^offer ride$/i })).not.toBeInTheDocument(),
    );
  });

  it("validates that a departure time is provided before offering", async () => {
    mockedFetch.mockResolvedValue({ data: [], error: null });

    render(<CarpoolSection eventId="evt-1" user={signedInUser} />);
    await screen.findByText(/No rides offered yet/);

    fireEvent.click(screen.getByRole("button", { name: /offer a ride/i }));
    fireEvent.change(screen.getByLabelText("Meeting point"), { target: { value: "Main gate" } });
    fireEvent.click(screen.getByRole("button", { name: /^offer ride$/i }));

    await waitFor(() => expect(mockedOffer).not.toHaveBeenCalled());
  });

  it("claims a seat on a carpool when the rider clicks Request Seat", async () => {
    mockedFetch.mockResolvedValue({ data: [activeCarpool], error: null });
    mockedClaim.mockResolvedValue({
      data: { success: true, code: "CLAIMED", message: "Seat claimed" },
      error: null,
    });

    render(<CarpoolSection eventId="evt-1" user={signedInUser} />);
    await screen.findByText("Alex Driver");

    fireEvent.click(screen.getByRole("button", { name: /request seat/i }));

    await waitFor(() => expect(mockedClaim).toHaveBeenCalledWith("cp-1"));
  });

  it("lets the driver cancel their own carpool after confirming", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    mockedFetch.mockResolvedValue({ data: [activeCarpool], error: null });
    mockedCancel.mockResolvedValue({
      data: { success: true, code: "CANCELLED", message: "Carpool cancelled" },
      error: null,
    });

    render(<CarpoolSection eventId="evt-1" user={driverUser} />);
    await screen.findByText("Alex Driver");

    fireEvent.click(screen.getByRole("button", { name: /cancel carpool/i }));

    await waitFor(() => expect(mockedCancel).toHaveBeenCalledWith("cp-1"));
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("does not cancel when the driver declines the confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockedFetch.mockResolvedValue({ data: [activeCarpool], error: null });

    render(<CarpoolSection eventId="evt-1" user={driverUser} />);
    await screen.findByText("Alex Driver");

    fireEvent.click(screen.getByRole("button", { name: /cancel carpool/i }));

    expect(mockedCancel).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("exposes leave action to a rider who holds a seat", async () => {
    const claimedCarpool = { ...activeCarpool, my_passenger_id: "pass-1", passenger_count: 3 };
    mockedFetch.mockResolvedValue({ data: [claimedCarpool], error: null });
    mockedLeave.mockResolvedValue({
      data: { success: true, code: "LEFT", message: "You left the carpool" },
      error: null,
    });

    render(<CarpoolSection eventId="evt-1" user={signedInUser} />);
    await screen.findByText("Alex Driver");

    fireEvent.click(screen.getByRole("button", { name: /leave ride/i }));

    await waitFor(() => expect(mockedLeave).toHaveBeenCalledWith("cp-1"));
  });

  it("renders a cancelled carpool without actions", async () => {
    const cancelledCarpool = { ...activeCarpool, status: "cancelled" as const };
    mockedFetch.mockResolvedValue({ data: [cancelledCarpool], error: null });

    render(<CarpoolSection eventId="evt-1" user={signedInUser} />);

    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("This ride was cancelled.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /request seat/i })).not.toBeInTheDocument();
  });
});
