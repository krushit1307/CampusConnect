// =============================================================================
// Service: AlumniSpeakerSentimentAggregator
// Issue: #5128 - Dynamic "Alumni Speaker" Live Audience Sentiment Overlay
// Description: Ephemeral in-memory realtime crowd sentiment aggregator.
// Calculates aggregate engagement every 5 seconds, flags low-engagement (< 30%),
// and broadcasts strictly to authorized presenter channels without exposing individual attendee data.
// =============================================================================

import { PresenterSentimentAggregatePayload } from "../../contracts/websocket-schemas";

export interface AttendeeSentimentRecord {
  sentiment: number;
  lastUpdated: number;
}

export type AggregateBroadcastCallback = (payload: PresenterSentimentAggregatePayload) => void;

export class AlumniSpeakerSentimentAggregator {
  // Ephemeral in-memory store: Map<eventId, Map<attendeeId, AttendeeSentimentRecord>>
  private sessions: Map<string, Map<string, AttendeeSentimentRecord>> = new Map();
  // Cached aggregates per event: Map<eventId, PresenterSentimentAggregatePayload>
  private cachedAggregates: Map<string, PresenterSentimentAggregatePayload> = new Map();
  // Callbacks for broadcasting aggregate updates
  private broadcastCallbacks: Set<AggregateBroadcastCallback> = new Set();
  // Interval timer handle
  private timerHandle: NodeJS.Timeout | null = null;
  // Interval duration in ms (default: 5000ms = 5s)
  private intervalMs: number = 5000;

  constructor(intervalMs: number = 5000) {
    this.intervalMs = intervalMs;
  }

  /**
   * Registers or updates an attendee's latest sentiment value for a specific event session.
   * Input range: 0 (Bored) to 100 (Mind Blown).
   */
  public recordSentiment(eventId: string, attendeeId: string, sentiment: number): boolean {
    if (!eventId || !attendeeId || typeof sentiment !== "number" || isNaN(sentiment)) {
      return false;
    }

    // Clamp sentiment value strictly between 0 and 100
    const clampedSentiment = Math.min(100, Math.max(0, Math.round(sentiment)));

    if (!this.sessions.has(eventId)) {
      this.sessions.set(eventId, new Map());
    }

    const eventAttendees = this.sessions.get(eventId)!;
    eventAttendees.set(attendeeId, {
      sentiment: clampedSentiment,
      lastUpdated: Date.now(),
    });

    return true;
  }

  /**
   * Calculates the 5-second aggregate sentiment for a specific event session.
   * Aggregate = sum(latest attendee sentiments) / number of active attendees.
   * Status = "low" if aggregate < 30%, otherwise "healthy".
   */
  public calculateAggregate(eventId: string): PresenterSentimentAggregatePayload {
    const attendeeMap = this.sessions.get(eventId);

    if (!attendeeMap || attendeeMap.size === 0) {
      const defaultPayload: PresenterSentimentAggregatePayload = {
        eventId,
        engagement: 50, // Default neutral baseline when no inputs
        status: "healthy",
        activeCount: 0,
        timestamp: new Date().toISOString(),
      };
      this.cachedAggregates.set(eventId, defaultPayload);
      return defaultPayload;
    }

    const sentiments = Array.from(attendeeMap.values()).map((r) => r.sentiment);
    const sum = sentiments.reduce((acc, curr) => acc + curr, 0);
    const mean = sum / sentiments.length;
    const engagement = Math.min(100, Math.max(0, Math.round(mean)));
    const status: "healthy" | "low" = engagement < 30 ? "low" : "healthy";

    const payload: PresenterSentimentAggregatePayload = {
      eventId,
      engagement,
      status,
      activeCount: sentiments.length,
      timestamp: new Date().toISOString(),
    };

    this.cachedAggregates.set(eventId, payload);
    return payload;
  }

  /**
   * Runs an aggregation tick across all active event sessions and notifies broadcast subscribers.
   */
  public tick(): PresenterSentimentAggregatePayload[] {
    const results: PresenterSentimentAggregatePayload[] = [];

    for (const eventId of this.sessions.keys()) {
      const aggregate = this.calculateAggregate(eventId);
      results.push(aggregate);
      this.notifySubscribers(aggregate);
    }

    return results;
  }

  /**
   * Starts the automatic 5-second aggregation timer cycle.
   */
  public start(): void {
    if (this.timerHandle) return;
    this.timerHandle = setInterval(() => {
      this.tick();
    }, this.intervalMs);
  }

  /**
   * Stops the automatic aggregation timer cycle.
   */
  public stop(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  /**
   * Subscribes a callback to receive aggregate broadcast updates.
   * Returns an unsubscribe function.
   */
  public onBroadcast(callback: AggregateBroadcastCallback): () => void {
    this.broadcastCallbacks.add(callback);
    return () => {
      this.broadcastCallbacks.delete(callback);
    };
  }

  /**
   * Gets the latest cached aggregate for an event (useful for late-connecting presenters).
   */
  public getLatestAggregate(eventId: string): PresenterSentimentAggregatePayload | null {
    if (this.cachedAggregates.has(eventId)) {
      return this.cachedAggregates.get(eventId)!;
    }
    if (this.sessions.has(eventId)) {
      return this.calculateAggregate(eventId);
    }
    return null;
  }

  /**
   * Removes a specific attendee from an event session (e.g. on disconnect).
   */
  public removeAttendee(eventId: string, attendeeId: string): void {
    const attendeeMap = this.sessions.get(eventId);
    if (attendeeMap) {
      attendeeMap.delete(attendeeId);
      if (attendeeMap.size === 0) {
        this.sessions.delete(eventId);
        this.cachedAggregates.delete(eventId);
      }
    }
  }

  /**
   * Cleans up an entire event session state when event ends.
   */
  public clearSession(eventId: string): void {
    this.sessions.delete(eventId);
    this.cachedAggregates.delete(eventId);
  }

  /**
   * Clears all session state.
   */
  public clearAll(): void {
    this.sessions.clear();
    this.cachedAggregates.clear();
  }

  /**
   * Gets list of active event IDs.
   */
  public getActiveEvents(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Helper to trigger broadcast callbacks.
   */
  private notifySubscribers(payload: PresenterSentimentAggregatePayload): void {
    for (const callback of this.broadcastCallbacks) {
      try {
        callback(payload);
      } catch (err) {
        console.error("[AlumniSpeakerSentimentAggregator] Error in broadcast subscriber:", err);
      }
    }
  }
}

// Global singleton instance for application use
export const globalSentimentAggregator = new AlumniSpeakerSentimentAggregator(5000);
