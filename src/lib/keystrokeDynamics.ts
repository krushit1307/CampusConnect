// src/lib/keystrokeDynamics.ts
// Issue: #5008 - Automated "Event Feedback" Linguistic Sentiment Drift
// Description: Client-side keystroke dynamics tracking for coercion detection

export interface KeystrokeEvent {
  key: string;
  timestamp: number;
  dwellTime: number; // Time key was held down (ms)
  flightTime: number; // Time since previous keystroke (ms)
}

export interface KeystrokeMetrics {
  keystrokeData: KeystrokeEvent[];
  avgDwellTime: number;
  avgFlightTime: number;
  backspaceCount: number;
  totalKeystrokes: number;
  typingDuration: number;
  correctionRate: number;
}

export class KeystrokeTracker {
  private keystrokes: KeystrokeEvent[] = [];
  private startTime: number | null = null;
  private lastKeydownTime: number | null = null;
  private keydownTimestamps: Map<string, number> = new Map();

  constructor() {
    if (typeof window !== "undefined") {
      this.startTime = Date.now();
    }
  }

  /**
   * Handle keydown event - record when key is pressed
   */
  handleKeyDown(event: KeyboardEvent): void {
    const now = Date.now();

    // Set start time on first keystroke
    if (!this.startTime) {
      this.startTime = now;
    }

    // Record when this key was pressed (for dwell time calculation)
    this.keydownTimestamps.set(event.key, now);

    // Calculate flight time (time since last keystroke)
    let flightTime = 0;
    if (this.lastKeydownTime !== null) {
      flightTime = now - this.lastKeydownTime;
    }

    this.lastKeydownTime = now;
  }

  /**
   * Handle keyup event - calculate dwell time and record complete event
   */
  handleKeyUp(event: KeyboardEvent): void {
    const now = Date.now();
    const keydownTime = this.keydownTimestamps.get(event.key);

    if (keydownTime !== undefined) {
      // Calculate dwell time (how long key was held down)
      const dwellTime = now - keydownTime;

      // Calculate flight time (time since previous keystroke)
      let flightTime = 0;
      if (this.lastKeydownTime !== null && this.keystrokes.length > 0) {
        flightTime = now - this.lastKeydownTime;
      }

      // Record the keystroke event
      this.keystrokes.push({
        key: event.key,
        timestamp: now,
        dwellTime,
        flightTime,
      });

      // Clean up the keydown timestamp
      this.keydownTimestamps.delete(event.key);
    }
  }

  /**
   * Get all recorded keystroke data
   */
  getKeystrokeData(): KeystrokeEvent[] {
    return [...this.keystrokes];
  }

  /**
   * Calculate metrics from collected keystroke data
   */
  getMetrics(): KeystrokeMetrics {
    const typingDuration = this.startTime ? Date.now() - this.startTime : 0;

    if (this.keystrokes.length === 0) {
      return {
        keystrokeData: [],
        avgDwellTime: 0,
        avgFlightTime: 0,
        backspaceCount: 0,
        totalKeystrokes: 0,
        typingDuration,
        correctionRate: 0,
      };
    }

    const dwellTimes = this.keystrokes.map((k) => k.dwellTime);
    const flightTimes = this.keystrokes.map((k) => k.flightTime);
    const backspaceCount = this.keystrokes.filter(
      (k) => k.key === "Backspace" || k.key === "Delete",
    ).length;

    const avgDwellTime = dwellTimes.reduce((sum, t) => sum + t, 0) / dwellTimes.length;
    const avgFlightTime = flightTimes.reduce((sum, t) => sum + t, 0) / flightTimes.length;
    const correctionRate = backspaceCount / this.keystrokes.length;

    return {
      keystrokeData: this.keystrokes,
      avgDwellTime,
      avgFlightTime,
      backspaceCount,
      totalKeystrokes: this.keystrokes.length,
      typingDuration,
      correctionRate,
    };
  }

  /**
   * Reset the tracker
   */
  reset(): void {
    this.keystrokes = [];
    this.startTime = null;
    this.lastKeydownTime = null;
    this.keydownTimestamps.clear();
  }

  /**
   * Get data formatted for database submission
   */
  getSubmissionData() {
    const metrics = this.getMetrics();
    return {
      keystroke_data: metrics.keystrokeData,
      avg_dwell_time_ms: metrics.avgDwellTime,
      avg_flight_time_ms: metrics.avgFlightTime,
      backspace_count: metrics.backspaceCount,
      correction_rate: metrics.correctionRate,
      typing_duration_ms: metrics.typingDuration,
    };
  }
}

/**
 * Hook-like function to attach keystroke tracking to a textarea/input
 */
export function attachKeystrokeTracker(
  element: HTMLTextAreaElement | HTMLInputElement,
  tracker: KeystrokeTracker,
): () => void {
  const handleKeyDown = (e: KeyboardEvent) => tracker.handleKeyDown(e);
  const handleKeyUp = (e: KeyboardEvent) => tracker.handleKeyUp(e);

  element.addEventListener("keydown", handleKeyDown);
  element.addEventListener("keyup", handleKeyUp);

  // Return cleanup function
  return () => {
    element.removeEventListener("keydown", handleKeyDown);
    element.removeEventListener("keyup", handleKeyUp);
  };
}

/**
 * Simple sentiment analysis using a basic word-based approach
 * In production, this should use a proper NLP library or API
 */
export function analyzeSentiment(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  const positiveWords = [
    "amazing",
    "awesome",
    "excellent",
    "great",
    "fantastic",
    "wonderful",
    "good",
    "love",
    "loved",
    "best",
    "perfect",
    "enjoyed",
    "fun",
    "brilliant",
    "outstanding",
    "superb",
    "magnificent",
    "terrific",
    "happy",
    "pleased",
    "delighted",
    "satisfied",
    "impressed",
  ];

  const negativeWords = [
    "terrible",
    "awful",
    "horrible",
    "bad",
    "worst",
    "hate",
    "hated",
    "disappointing",
    "disappointed",
    "boring",
    "bored",
    "poor",
    "dreadful",
    "abysmal",
    "appalling",
    "atrocious",
    "lousy",
    "unhappy",
    "unsatisfied",
    "annoyed",
    "frustrated",
    "angry",
  ];

  const lowerText = text.toLowerCase();
  let score = 0;

  positiveWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    const matches = lowerText.match(regex);
    if (matches) {
      score += matches.length * 0.5;
    }
  });

  negativeWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    const matches = lowerText.match(regex);
    if (matches) {
      score -= matches.length * 0.5;
    }
  });

  // Normalize to -1 to 1 range
  return Math.max(-1, Math.min(1, score));
}
