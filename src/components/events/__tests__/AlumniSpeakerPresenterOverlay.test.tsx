// =============================================================================
// Component Tests: AlumniSpeakerPresenterOverlay & AlumniSpeakerEngagementMeter
// Issue: #5128 - Dynamic "Alumni Speaker" Live Audience Sentiment Overlay
// Description: RTL unit tests asserting low engagement (< 30%) red glow alerts,
// healthy states, and interactive engagement meter slider behavior.
// =============================================================================

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AlumniSpeakerPresenterOverlay } from "../AlumniSpeakerPresenterOverlay";
import { AlumniSpeakerEngagementMeter } from "../AlumniSpeakerEngagementMeter";
import { globalSentimentAggregator } from "@/services/alumniSpeakerSentimentAggregator";

vi.mock("@/lib/socket", () => ({
  getSocketClient: () => ({
    isConnected: false,
    on: () => () => {},
    emit: () => {},
  }),
}));

describe("AlumniSpeakerPresenterOverlay Component (#5128)", () => {
  const eventId = "test-event-5128";

  beforeEach(() => {
    globalSentimentAggregator.clearAll();
  });

  afterEach(() => {
    globalSentimentAggregator.clearAll();
  });

  it("renders healthy state with normal indicator when aggregate is above 30%", () => {
    globalSentimentAggregator.recordSentiment(eventId, "user-1", 75);

    render(<AlumniSpeakerPresenterOverlay eventId={eventId} speakerName="Dr. Elena" />);

    expect(screen.getByText(/Dr. Elena — Live Crowd Overlay/i)).toBeInTheDocument();
    expect(screen.getByTestId("presenter-overlay-container")).toHaveAttribute(
      "data-status",
      "healthy",
    );
    expect(screen.queryByTestId("low-engagement-alert")).not.toBeInTheDocument();
    expect(screen.getByText(/HEALTHY ENGAGEMENT/i)).toBeInTheDocument();
  });

  it("turns RED with low-engagement alert banner when aggregate drops below 30%", () => {
    globalSentimentAggregator.recordSentiment(eventId, "user-1", 20);

    render(<AlumniSpeakerPresenterOverlay eventId={eventId} speakerName="Dr. Elena" />);

    const container = screen.getByTestId("presenter-overlay-container");
    expect(container).toHaveAttribute("data-status", "low");
    expect(container.className).toContain("border-rose-500");

    const alert = screen.getByTestId("low-engagement-alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/Presenter Alert — Crowd Engagement Under 30%!/i);
    expect(screen.getByText(/CRITICAL: LOW ENGAGEMENT/i)).toBeInTheDocument();
  });

  it("updates dynamically when attendee sentiment is registered", () => {
    const { rerender } = render(
      <AlumniSpeakerPresenterOverlay eventId={eventId} speakerName="Dr. Elena" />,
    );

    // Initial neutral state
    expect(screen.getByTestId("presenter-overlay-container")).toHaveAttribute(
      "data-status",
      "healthy",
    );

    // Record low sentiment and trigger tick
    act(() => {
      globalSentimentAggregator.recordSentiment(eventId, "user-1", 15);
      globalSentimentAggregator.tick();
    });

    rerender(<AlumniSpeakerPresenterOverlay eventId={eventId} speakerName="Dr. Elena" />);

    expect(screen.getByTestId("presenter-overlay-container")).toHaveAttribute("data-status", "low");
    expect(screen.getByTestId("low-engagement-alert")).toBeInTheDocument();
  });
});

describe("AlumniSpeakerEngagementMeter Component (#5128)", () => {
  const eventId = "test-event-5128";
  const attendeeId = "student-123";

  beforeEach(() => {
    globalSentimentAggregator.clearAll();
  });

  afterEach(() => {
    globalSentimentAggregator.clearAll();
  });

  it("renders slider with Bored and Mind Blown labels", () => {
    render(<AlumniSpeakerEngagementMeter eventId={eventId} attendeeId={attendeeId} />);

    expect(screen.getByText("Live Engagement Meter")).toBeInTheDocument();
    expect(screen.getByText("Bored")).toBeInTheDocument();
    expect(screen.getByText("Mind Blown")).toBeInTheDocument();

    const slider = screen.getByRole("slider");
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "100");
  });

  it("updates state and registers sentiment in aggregator on slider change", () => {
    vi.useFakeTimers();

    render(<AlumniSpeakerEngagementMeter eventId={eventId} attendeeId={attendeeId} />);

    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "85" } });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const latest = globalSentimentAggregator.getLatestAggregate(eventId);
    expect(latest?.engagement).toBe(85);

    vi.useRealTimers();
  });
});
