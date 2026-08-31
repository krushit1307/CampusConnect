import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RealTimeEmergencyRollCallDashboard } from "../RealTimeEmergencyRollCallDashboard";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
    }),
  }),
}));

describe("RealTimeEmergencyRollCallDashboard Component", () => {
  it("renders emergency roll call dashboard title", () => {
    render(
      <RealTimeEmergencyRollCallDashboard
        eventId="evt-mountain-hike"
        eventTitle="Annual Mountain Camping & Hiking Trip"
      />,
    );

    expect(screen.getByText("Real-Time Campus Safety Emergency Roll Call")).toBeInTheDocument();
    expect(screen.getByText("Annual Mountain Camping & Hiking Trip")).toBeInTheDocument();
  });

  it("renders metrics cards with registered attendees, safe count, and countdown", () => {
    render(
      <RealTimeEmergencyRollCallDashboard
        eventId="evt-mountain-hike"
        eventTitle="Annual Mountain Camping & Hiking Trip"
      />,
    );

    expect(screen.getByText("Total Registered")).toBeInTheDocument();
    expect(screen.getByText("Needs Assistance")).toBeInTheDocument();
    expect(screen.getByText("Overdue / Unresponsive")).toBeInTheDocument();
    expect(screen.getByText("Timer Countdown")).toBeInTheDocument();
  });

  it("displays attendee roster stream with status badges and emergency contacts", () => {
    render(
      <RealTimeEmergencyRollCallDashboard
        eventId="evt-mountain-hike"
        eventTitle="Annual Mountain Camping & Hiking Trip"
      />,
    );

    expect(screen.getByTestId("roll-call-roster")).toBeInTheDocument();
    expect(screen.getByText("Maya Lin")).toBeInTheDocument();
    expect(screen.getByText("Chloe Bennett")).toBeInTheDocument();
  });

  it("allows student to confirm safety check-in via 'I Am Safe' button", async () => {
    render(
      <RealTimeEmergencyRollCallDashboard
        eventId="evt-mountain-hike"
        eventTitle="Annual Mountain Camping & Hiking Trip"
      />,
    );

    const safeBtn = screen.getByTestId("student-check-safe-btn");
    fireEvent.click(safeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Safety confirmed/i)).toBeInTheDocument();
    });
  });
});
