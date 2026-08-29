/**
 * Types and interfaces for Automated Event Feedback Linguistic Sentiment Drift analysis.
 * Issue: #5008 - Automated "Event Feedback" Linguistic Sentiment Drift
 */

export type DriftDirection = "IMPROVING" | "STABLE" | "DECLINING" | "COERCION_SPIKE";

export type DriftAlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface LinguisticSentimentPoint {
  id: string;
  timestamp: string;
  sentimentScore: number; // -1.0 to +1.0
  coercionAnomalyScore: number; // 0 to 100
  rating: number; // 1 to 5
  feedbackText: string;
  keywords: string[];
}

export interface LinguisticTermShift {
  term: string;
  baselineFrequency: number;
  currentFrequency: number;
  changePercentage: number;
  polarity: "positive" | "negative" | "neutral";
  impactScore: number;
}

export interface EventLinguisticSentimentDriftAnalysis {
  eventId: string;
  eventTitle: string;
  baselineSentiment: number;
  currentSentiment: number;
  driftDelta: number; // current - baseline
  driftRatePercent: number;
  driftDirection: DriftDirection;
  severity: DriftAlertSeverity;
  totalFeedbackCount: number;
  coercionFlaggedCount: number;
  isCoercionSpikeDetected: boolean;
  termShifts: LinguisticTermShift[];
  timeline: LinguisticSentimentPoint[];
  executiveSummaryMarkdown: string;
  recommendations: string[];
  analyzedAt: string;
}

export interface DriftConfig {
  baselineWindowDays?: number;
  currentWindowDays?: number;
  declineThresholdDelta?: number; // e.g. -0.25
  coercionAnomalyThreshold?: number; // e.g. 60
  minFeedbackCount?: number;
}
