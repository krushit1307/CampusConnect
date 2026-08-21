import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SpeakerArrivalBoard } from "./SpeakerArrivalBoard";
import {
  projectArrival,
  sortByRisk,
  type ItineraryLeg,
  type SpeakerItinerary,
  type TravelMode,
} from "@/lib/speakerItinerary";

const mockUseArrivalBoard = vi.fn();

vi.mock("@/hooks/useArrivalBoard", () => ({
  useArrivalBoard: (...args: unknown[]) => mockUseArrivalBoard(...args),
}));

function leg(
  sequence: number,
  mode: TravelMode,
  origin: string,
  destination: string,
  departure: string,
  arrival: string,
  delayMinutes = 0,
): ItineraryLeg {
  return {
    id: `leg-${sequence}`,
    sequence,
    mode,
    carrier: "Test Air",
    reference: `TA${sequence}00`,
    origin,
    destination,
    scheduledDeparture: departure,
    scheduledArrival: arrival,
    delayMinutes,
  };
}

function itinerary(overrides: Partial<SpeakerItinerary> = {}): SpeakerItinerary {
  return {
    id: "it-1",
    speakerName: "Dr Anita Rao",
    direction: "inbound",
    callTime: "2026-06-10T10:00:00.000Z",
    sessionTitle: "Opening keynote",
    hostName: "Ravi Sharma",
    groundTransferMinutes: 70,
    legs: [
      leg(1, "rail", "Central", "Campus Town", "2026-06-10T04:00:00Z", "2026-06-10T06:00:00Z"),
    ],
    ...overrides,
  };
}

/** The at-risk journey from the issue: lands 09:15, due on site at 10:00. */
function lateItinerary(): SpeakerItinerary {
  return itinerary({
    id: "it-late",
    speakerName: "Prof Liu Chen",
    legs: [
      leg(1, "flight_international", "SIN", "BLR", "2026-06-10T03:00:00Z", "2026-06-10T09:15:00Z"),
    ],
  });
}

function hookResult(
  itineraries: SpeakerItinerary[] = [itinerary()],
  overrides: Record<string, unknown> = {},
) {
  const projections = sortByRisk(itineraries.map(projectArrival));
  return {
    projections,
    atRisk: projections.filter((p) => p.band !== "comfortable"),
    unhosted: projections.filter((p) => !p.hostName),
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    reportDelay: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockUseArrivalBoard.mockReset();
});

describe("SpeakerArrivalBoard", () => {
  it("shows a loading state while arrivals are projected", () => {
    mockUseArrivalBoard.mockReturnValue(hookResult([itinerary()], { isLoading: true }));
    render(<SpeakerArrivalBoard eventId="e1" />);
    expect(screen.getByText(/Projecting speaker arrivals/i)).toBeTruthy();
  });

  it("surfaces an error with a retry", async () => {
    const refresh = vi.fn();
    mockUseArrivalBoard.mockReturnValue(
      hookResult([itinerary()], { error: "not authorised", refresh }),
    );
    render(<SpeakerArrivalBoard eventId="e1" />);

    expect(screen.getByText(/not authorised/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("renders an empty state when no journeys are recorded", () => {
    mockUseArrivalBoard.mockReturnValue(hookResult([]));
    render(<SpeakerArrivalBoard eventId="e1" />);
    expect(screen.getByText(/No inbound speaker journeys have been recorded/i)).toBeTruthy();
  });

  it("shows the buffer and band for a comfortable journey", () => {
    mockUseArrivalBoard.mockReturnValue(hookResult([itinerary()]));
    render(<SpeakerArrivalBoard eventId="e1" />);

    expect(screen.getByText("Dr Anita Rao")).toBeTruthy();
    expect(screen.getByText("Comfortable")).toBeTruthy();
    // Matches both the buffer figure and the reassurance line.
    expect(screen.getAllByText(/spare/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Arriving with room to spare/i)).toBeTruthy();
  });

  it("flags a speaker projected to arrive after their call time", () => {
    mockUseArrivalBoard.mockReturnValue(hookResult([lateItinerary()]));
    render(<SpeakerArrivalBoard eventId="e1" />);

    expect(screen.getByText("Will miss session")).toBeTruthy();
    expect(screen.getByText(/after the call time/i)).toBeTruthy();
    expect(screen.getByText(/late$/)).toBeTruthy();
  });

  it("puts the riskiest speaker first", () => {
    mockUseArrivalBoard.mockReturnValue(hookResult([itinerary(), lateItinerary()]));
    render(<SpeakerArrivalBoard eventId="e1" />);

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings[0].textContent).toBe("Prof Liu Chen");
  });

  it("summarises how many journeys need attention", () => {
    mockUseArrivalBoard.mockReturnValue(hookResult([itinerary(), lateItinerary()]));
    render(<SpeakerArrivalBoard eventId="e1" />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/1 of 2 journeys need attention/i)).toBeTruthy();
  });

  it("does not raise an alert when every journey is comfortable", () => {
    mockUseArrivalBoard.mockReturnValue(hookResult([itinerary()]));
    render(<SpeakerArrivalBoard eventId="e1" />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("names the host, or says nobody is meeting them", () => {
    mockUseArrivalBoard.mockReturnValue(
      hookResult([itinerary(), itinerary({ id: "it-2", hostName: null })]),
    );
    render(<SpeakerArrivalBoard eventId="e1" />);

    expect(screen.getByText(/host Ravi Sharma/)).toBeTruthy();
    expect(screen.getAllByText(/no host assigned/).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 speaker has no host assigned/i)).toBeTruthy();
  });

  it("auto-expands a journey that will miss its session", () => {
    mockUseArrivalBoard.mockReturnValue(hookResult([lateItinerary()]));
    render(<SpeakerArrivalBoard eventId="e1" />);
    // Expanded means the arithmetic breakdown is already visible.
    expect(screen.getByText(/How this arrival was calculated/i)).toBeTruthy();
  });

  it("keeps a comfortable journey collapsed until asked", () => {
    mockUseArrivalBoard.mockReturnValue(hookResult([itinerary()]));
    render(<SpeakerArrivalBoard eventId="e1" />);

    expect(screen.queryByText(/How this arrival was calculated/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /show journey/i }));
    expect(screen.getByText(/How this arrival was calculated/i)).toBeTruthy();
  });

  it("spells out the immigration and transfer arithmetic", () => {
    mockUseArrivalBoard.mockReturnValue(hookResult([lateItinerary()]));
    render(<SpeakerArrivalBoard eventId="e1" />);

    expect(screen.getAllByText(/immigration and baggage/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ground transfer to campus/i).length).toBeGreaterThan(0);
  });

  it("reports a delay entered against a leg", async () => {
    const reportDelay = vi.fn();
    mockUseArrivalBoard.mockReturnValue(hookResult([lateItinerary()], { reportDelay }));
    render(<SpeakerArrivalBoard eventId="e1" />);

    const input = screen.getByLabelText(/delay \(min\)/i);
    fireEvent.change(input, { target: { value: "45" } });
    fireEvent.blur(input);

    await waitFor(() => expect(reportDelay).toHaveBeenCalledWith("leg-1", 45));
  });

  it("does not re-report a delay that has not changed", () => {
    const reportDelay = vi.fn();
    mockUseArrivalBoard.mockReturnValue(hookResult([lateItinerary()], { reportDelay }));
    render(<SpeakerArrivalBoard eventId="e1" />);

    const input = screen.getByLabelText(/delay \(min\)/i);
    fireEvent.blur(input);
    expect(reportDelay).not.toHaveBeenCalled();
  });

  it("passes the event and direction through to the hook", () => {
    mockUseArrivalBoard.mockReturnValue(hookResult([]));
    render(<SpeakerArrivalBoard eventId="event-4" direction="outbound" />);
    expect(mockUseArrivalBoard).toHaveBeenCalledWith("event-4", "outbound");
  });
});
