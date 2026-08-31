// =============================================================================
// Unit Tests: AlumniSpeakerSentimentAggregator
// Issue: #5128 - Dynamic "Alumni Speaker" Live Audience Sentiment Overlay
// Description: Exhaustive tests for ephemeral in-memory realtime crowd sentiment aggregator.
// Asserts 5-second aggregation, low-engagement threshold (< 30%), session isolation, and privacy.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AlumniSpeakerSentimentAggregator } from "../alumniSpeakerSentimentAggregator";
import { PresenterSentimentAggregateSchema } from "../../../contracts/websocket-schemas";

describe("AlumniSpeakerSentimentAggregator (#5128)", () => {
  let aggregator: AlumniSpeakerSentimentAggregator;

  beforeEach(() => {
    aggregator = new AlumniSpeakerSentimentAggregator(5000);
  });

  afterEach(() => {
    aggregator.stop();
    aggregator.clearAll();
  });

  it("calculates baseline aggregate when no attendees have submitted", () => {
    const aggregate = aggregator.calculateAggregate("event-101");

    expect(aggregate.eventId).toBe("event-101");
    expect(aggregate.engagement).toBe(50);
    expect(aggregate.status).toBe("healthy");
    expect(aggregate.activeCount).toBe(0);
  });

  it("calculates correct aggregate for a single attendee", () => {
    aggregator.recordSentiment("event-101", "attendee-1", 85);

    const aggregate = aggregator.calculateAggregate("event-101");

    expect(aggregate.engagement).toBe(85);
    expect(aggregate.status).toBe("healthy");
    expect(aggregate.activeCount).toBe(1);
  });

  it("calculates correct mean for multiple attendees", () => {
    aggregator.recordSentiment("event-101", "attendee-1", 70);
    aggregator.recordSentiment("event-101", "attendee-2", 45);
    aggregator.recordSentiment("event-101", "attendee-3", 20);

    // Mean = (70 + 45 + 20) / 3 = 135 / 3 = 45
    const aggregate = aggregator.calculateAggregate("event-101");

    expect(aggregate.engagement).toBe(45);
    expect(aggregate.status).toBe("healthy");
    expect(aggregate.activeCount).toBe(3);
  });

  it("replaces previous value when same attendee submits multiple times (prevents spam bias)", () => {
    aggregator.recordSentiment("event-101", "attendee-1", 90);
    aggregator.recordSentiment("event-101", "attendee-1", 20); // Overwrite

    const aggregate = aggregator.calculateAggregate("event-101");

    expect(aggregate.engagement).toBe(20);
    expect(aggregate.activeCount).toBe(1);
  });

  it("flags status as 'low' when aggregate drops strictly below 30%", () => {
    aggregator.recordSentiment("event-101", "attendee-1", 25);
    aggregator.recordSentiment("event-101", "attendee-2", 20);

    // Mean = 22.5 -> 23% (< 30)
    const aggregate = aggregator.calculateAggregate("event-101");

    expect(aggregate.engagement).toBe(23);
    expect(aggregate.status).toBe("low");
  });

  it("flags status as 'healthy' when aggregate is exactly 30% or above", () => {
    aggregator.recordSentiment("event-101", "attendee-1", 30);

    const aggregate = aggregator.calculateAggregate("event-101");

    expect(aggregate.engagement).toBe(30);
    expect(aggregate.status).toBe("healthy");
  });

  it("enforces strict event isolation between separate sessions", () => {
    aggregator.recordSentiment("event-A", "attendee-1", 90);
    aggregator.recordSentiment("event-B", "attendee-1", 10);

    const aggA = aggregator.calculateAggregate("event-A");
    const aggB = aggregator.calculateAggregate("event-B");

    expect(aggA.engagement).toBe(90);
    expect(aggB.engagement).toBe(10);
    expect(aggB.status).toBe("low");
  });

  it("clamps sentiment inputs strictly to 0-100 range", () => {
    aggregator.recordSentiment("event-101", "attendee-1", 150); // Above 100
    aggregator.recordSentiment("event-101", "attendee-2", -40); // Below 0

    const aggregate = aggregator.calculateAggregate("event-101");

    // Mean = (100 + 0) / 2 = 50
    expect(aggregate.engagement).toBe(50);
  });

  it("ensures presenter aggregate payload matches Zod schema and contains no attendee identity", () => {
    aggregator.recordSentiment("event-101", "secret-user-999", 75);

    const aggregate = aggregator.calculateAggregate("event-101");

    // Zod schema validation
    const parsed = PresenterSentimentAggregateSchema.safeParse(aggregate);
    expect(parsed.success).toBe(true);

    // Privacy assertion: No attendee ID property exists in broadcast payload
    expect(aggregate).not.toHaveProperty("attendeeId");
    expect(aggregate).not.toHaveProperty("userId");
    expect(JSON.stringify(aggregate)).not.toContain("secret-user-999");
  });

  it("notifies broadcast subscribers on tick cycle", () => {
    const callback = vi.fn();
    aggregator.onBroadcast(callback);

    aggregator.recordSentiment("event-101", "attendee-1", 80);
    aggregator.tick();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "event-101",
        engagement: 80,
        status: "healthy",
      }),
    );
  });
});
