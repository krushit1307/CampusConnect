import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EventLinguisticSentimentDriftView } from "../EventLinguisticSentimentDriftView";
import { EventLinguisticSentimentDriftAnalysis } from "@/types/eventLinguisticSentimentDrift";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }),
}));

const mockAnalysis: EventLinguisticSentimentDriftAnalysis = {
  eventId: "ev-100",
  eventTitle: "Annual Robotics Showcase",
  baselineSentiment: 0.6,
  currentSentiment: 0.15,
  driftDelta: -0.45,
  driftRatePercent: -75.0,
  driftDirection: "DECLINING",
  severity: "CRITICAL",
  totalFeedbackCount: 12,
  coercionFlaggedCount: 2,
  isCoercionSpikeDetected: true,
  termShifts: [
    {
      term: "delay",
      baselineFrequency: 0.05,
      currentFrequency: 0.25,
      changePercentage: 400,
      polarity: "negative",
      impactScore: 20.0,
    },
    {
      term: "great",
      baselineFrequency: 0.3,
      currentFrequency: 0.05,
      changePercentage: -83,
      polarity: "positive",
      impactScore: 25.0,
    },
  ],
  timeline: [
    {
      id: "pt-1",
      timestamp: "2026-08-29T10:00:00Z",
      sentimentScore: -0.3,
      coercionAnomalyScore: 70,
      rating: 2,
      feedbackText: "Long delay at registration Desk.",
      keywords: ["delay", "registration"],
    },
  ],
  executiveSummaryMarkdown: "## Executive Summary\n\nSignificant negative drift detected.",
  recommendations: [
    "Review recent attendee comments highlighting emerging complaints.",
    "Engage speaker/organizer team.",
  ],
  analyzedAt: "2026-08-29T12:00:00Z",
};

describe("EventLinguisticSentimentDriftView Component", () => {
  it("renders dashboard title and event title", () => {
    render(
      <EventLinguisticSentimentDriftView
        eventId="ev-100"
        eventTitle="Annual Robotics Showcase"
        initialAnalysis={mockAnalysis}
      />,
    );

    expect(screen.getByText("Linguistic Sentiment Drift Tracker")).toBeInTheDocument();
    expect(screen.getByText("Annual Robotics Showcase")).toBeInTheDocument();
  });

  it("displays metric cards with baseline, current sentiment and drift delta", () => {
    render(
      <EventLinguisticSentimentDriftView
        eventId="ev-100"
        eventTitle="Annual Robotics Showcase"
        initialAnalysis={mockAnalysis}
      />,
    );

    expect(screen.getByText("Baseline Sentiment")).toBeInTheDocument();
    expect(screen.getByText("+0.6")).toBeInTheDocument();
    expect(screen.getByText("+0.15")).toBeInTheDocument();
    expect(screen.getByText("-0.45")).toBeInTheDocument();
  });

  it("renders coercion anomaly alert banner when spike is detected", () => {
    render(
      <EventLinguisticSentimentDriftView
        eventId="ev-100"
        eventTitle="Annual Robotics Showcase"
        initialAnalysis={mockAnalysis}
      />,
    );

    expect(screen.getByTestId("coercion-alert-banner")).toBeInTheDocument();
    expect(screen.getByText(/Coercion Anomaly Detected/i)).toBeInTheDocument();
  });

  it("switches tabs when tab buttons are clicked", () => {
    render(
      <EventLinguisticSentimentDriftView
        eventId="ev-100"
        eventTitle="Annual Robotics Showcase"
        initialAnalysis={mockAnalysis}
      />,
    );

    const termsTabBtn = screen.getByRole("button", { name: /Linguistic Term Shifts/i });
    fireEvent.click(termsTabBtn);

    expect(screen.getByTestId("term-shifts-tab")).toBeInTheDocument();
    expect(screen.getByText("delay")).toBeInTheDocument();

    const timelineTabBtn = screen.getByRole("button", { name: /Feedback Stream/i });
    fireEvent.click(timelineTabBtn);

    expect(screen.getByTestId("timeline-tab")).toBeInTheDocument();
    expect(screen.getByText(/Long delay at registration Desk/i)).toBeInTheDocument();
  });
});
