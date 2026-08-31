/**
 * ActivityInsightsReport.test.tsx — Tests for the campus activity insights report page.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ActivityInsightsReport from "./ActivityInsightsReport";

// Mock the useCampusActivityInsights hook
vi.mock("@/hooks/useCampusActivityInsights", () => ({
  useCampusActivityInsights: vi.fn(() => ({
    report: {
      weeklyTrends: [
        {
          week: 1,
          label: "Week 1",
          events: 10,
          rsvps: 250,
          fillRate: 0.65,
          topCategory: "tech",
          topLocation: "Main Auditorium",
          clubCount: 5,
        },
        {
          week: 2,
          label: "Week 2",
          events: 12,
          rsvps: 300,
          fillRate: 0.72,
          topCategory: "workshop",
          topLocation: "CS Lab B",
          clubCount: 6,
        },
      ],
      trendComparisons: [
        {
          metric: "Total Events",
          firstHalf: 45,
          secondHalf: 60,
          change: 15,
          changePercent: 33.3,
          direction: "up",
        },
        {
          metric: "Total RSVPs",
          firstHalf: 1200,
          secondHalf: 1800,
          change: 600,
          changePercent: 50,
          direction: "up",
        },
      ],
      predictions: [
        {
          week: 13,
          label: "Week 13",
          predictedRsvps: 320,
          lowerBound: 280,
          upperBound: 360,
          confidence: 82,
        },
      ],
      clubPerformance: [
        {
          club: "CS Club",
          eventCount: 18,
          totalRsvps: 2400,
          avgFillRate: 0.78,
          growthRate: 0.25,
          consistencyScore: 85,
          overallScore: 92,
        },
      ],
      locationInsights: [
        {
          location: "Main Auditorium",
          utilizationRate: 0.82,
          peakWindow: "10:00–12:00",
          recommendedAction: "High demand venue",
          trend: "growing",
        },
      ],
      categoryInsights: [
        {
          category: "tech",
          totalEvents: 30,
          totalRsvps: 1500,
          avgFillRate: 0.72,
          growthRate: 0.18,
          recommendedFocus: "Strong growth",
        },
      ],
      topInsights: [
        "RSVPs increased by 50% in the second half of the semester.",
        "CS Club leads with a score of 92/100.",
      ],
      summaryScore: 78,
    },
    fullDataset: {
      timeSlots: [],
      locations: [],
      clubs: [],
      rsvpVelocity: [],
      categories: [],
      summaryStats: {},
    },
    allClubs: ["CS Club", "Music Society", "Drama Club"],
    allLocations: ["Main Auditorium", "CS Lab B", "Sports Complex"],
    reportFilters: {
      weekRange: [1, 12],
      selectedClubs: [],
      selectedLocations: [],
      compareMode: "first-half-second-half",
    },
    setWeekRange: vi.fn(),
    toggleClub: vi.fn(),
    toggleLocation: vi.fn(),
    setCompareMode: vi.fn(),
    resetFilters: vi.fn(),
    exportReport: vi.fn(),
    exportCSV: vi.fn(),
  })),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    circle: ({ ...props }: any) => <circle {...props} />,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("ActivityInsightsReport", () => {
  function renderReport() {
    return render(
      <MemoryRouter>
        <ActivityInsightsReport />
      </MemoryRouter>,
    );
  }

  it("renders the page title", () => {
    renderReport();
    expect(screen.getByText("Campus Activity Insights Report")).toBeInTheDocument();
  });

  it("displays the campus health score", () => {
    renderReport();
    expect(screen.getByText("Campus Health Score")).toBeInTheDocument();
    expect(screen.getByText("78")).toBeInTheDocument();
  });

  it("shows key insights section", () => {
    renderReport();
    expect(screen.getByText("Key Insights")).toBeInTheDocument();
    expect(
      screen.getByText("RSVPs increased by 50% in the second half of the semester."),
    ).toBeInTheDocument();
  });

  it("displays trend comparison cards", () => {
    renderReport();
    expect(screen.getByText("Trend Comparisons")).toBeInTheDocument();
    expect(screen.getByText("Total Events")).toBeInTheDocument();
    expect(screen.getByText("Total RSVPs")).toBeInTheDocument();
  });

  it("shows predictive analytics section", () => {
    renderReport();
    expect(screen.getByText("Predictive Analytics")).toBeInTheDocument();
    expect(screen.getByText("RSVP Trend & Forecast")).toBeInTheDocument();
  });

  it("displays club performance rankings", () => {
    renderReport();
    expect(screen.getByText("Club Performance Rankings")).toBeInTheDocument();
    expect(screen.getByText("CS Club")).toBeInTheDocument();
  });

  it("shows location insights", () => {
    renderReport();
    expect(screen.getByText("Location Insights")).toBeInTheDocument();
    expect(screen.getByText("Main Auditorium")).toBeInTheDocument();
  });

  it("displays category analysis", () => {
    renderReport();
    expect(screen.getByText("Category Analysis")).toBeInTheDocument();
    expect(screen.getByText("Tech")).toBeInTheDocument();
  });

  it("has export buttons", () => {
    renderReport();
    expect(screen.getByText("CSV")).toBeInTheDocument();
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("has a filter button", () => {
    renderReport();
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });
});
