import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DominosProgressTracker } from "../DominosProgressTracker";
import { FulfillmentMetricsBar } from "../FulfillmentMetricsBar";
import { AccommodationRequest } from "@/types/accessibilityFulfillment";

// Mock framer-motion to avoid animation timing issues in test runner
vi.mock("framer-motion", () => ({
  m: {
    div: ({ children, className, style, onClick }: any) => (
      <div className={className} style={style} onClick={onClick}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const MOCK_REQUEST: AccommodationRequest = {
  id: "ACC-9999",
  studentId: "user-1",
  studentName: "Test Student",
  studentAvatar: "https://example.com/avatar.jpg",
  category: "mobility",
  accommodationType: "Portable Ramp",
  eventOrLocation: "Annual Gala",
  buildingName: "Student Center",
  roomNumber: "Hall 1",
  urgency: "high",
  currentStage: "dispatched",
  status: "on_schedule",
  destinationLocation: { lat: 37.77, lng: -122.41 },
  etaMinutes: 8,
  submittedAt: new Date(),
  estimatedFulfillmentAt: new Date(),
  notes: "Test notes",
  stageTimestamps: {
    submitted: new Date(),
    triaged: new Date(),
    dispatched: new Date(),
  },
  timelineLogs: [],
};

describe("DominosProgressTracker", () => {
  it("renders accommodation request details and stage milestone labels", () => {
    render(<DominosProgressTracker request={MOCK_REQUEST} />);

    expect(screen.getByText("ACC-9999")).toBeInTheDocument();
    expect(screen.getByText("Portable Ramp")).toBeInTheDocument();
    expect(screen.getByText("Request Logged")).toBeInTheDocument();
    expect(screen.getByText("Specialist Dispatched")).toBeInTheDocument();
    expect(screen.getByText("Fulfilled & Active")).toBeInTheDocument();
  });

  it("calls onAdvanceStage when Advance Stage button is clicked", () => {
    const handleAdvance = vi.fn();
    render(<DominosProgressTracker request={MOCK_REQUEST} onAdvanceStage={handleAdvance} />);

    const button = screen.getByRole("button", { name: /Advance Stage/i });
    fireEvent.click(button);

    expect(handleAdvance).toHaveBeenCalledTimes(1);
  });
});

describe("FulfillmentMetricsBar", () => {
  it("renders key metric statistics", () => {
    render(
      <FulfillmentMetricsBar
        metrics={{
          totalRequests: 10,
          activeRequests: 3,
          completedRequests: 7,
          avgResolutionMinutes: 12.5,
          satisfactionScore: 4.8,
          onTimePercentage: 98.2,
        }}
      />,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("12.5")).toBeInTheDocument();
    expect(screen.getByText("98.2%")).toBeInTheDocument();
    expect(screen.getByText("4.8")).toBeInTheDocument();
  });
});
