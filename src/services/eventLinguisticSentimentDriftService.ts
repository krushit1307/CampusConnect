import { createClient } from "@/lib/supabase/client";
import { analyzeSentiment } from "@/lib/keystrokeDynamics";
import {
  DriftConfig,
  DriftDirection,
  DriftAlertSeverity,
  EventLinguisticSentimentDriftAnalysis,
  LinguisticSentimentPoint,
  LinguisticTermShift,
} from "@/types/eventLinguisticSentimentDrift";

const supabase = createClient();

const COMMON_STOP_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for",
  "not", "on", "with", "he", "as", "you", "do", "at", "this", "but", "his", "by",
  "from", "they", "we", "say", "her", "she", "or", "an", "will", "my", "one",
  "all", "would", "there", "their", "what", "so", "up", "out", "if", "about",
  "who", "get", "which", "go", "me", "was", "were", "is", "are", "been", "had",
  "event", "feedback", "very", "really", "just", "also", "than", "then", "more",
]);

export class EventLinguisticSentimentDriftService {
  private defaultConfig: Required<DriftConfig> = {
    baselineWindowDays: 30,
    currentWindowDays: 7,
    declineThresholdDelta: -0.25,
    coercionAnomalyThreshold: 60,
    minFeedbackCount: 3,
  };

  /**
   * Tokenizes text and filters out common stop words and punctuation.
   */
  public tokenizeText(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !COMMON_STOP_WORDS.has(word));
  }

  /**
   * Calculates baseline vs current sentiment and classifies drift direction and severity.
   */
  public calculateSentimentMetrics(
    baselineScores: number[],
    currentScores: number[],
    coercionSpikeCount: number,
    config: DriftConfig = {},
  ): {
    baselineSentiment: number;
    currentSentiment: number;
    driftDelta: number;
    driftRatePercent: number;
    driftDirection: DriftDirection;
    severity: DriftAlertSeverity;
  } {
    const cfg = { ...this.defaultConfig, ...config };

    const baselineSentiment =
      baselineScores.length > 0
        ? baselineScores.reduce((a, b) => a + b, 0) / baselineScores.length
        : 0;

    const currentSentiment =
      currentScores.length > 0
        ? currentScores.reduce((a, b) => a + b, 0) / currentScores.length
        : baselineSentiment;

    const driftDelta = currentSentiment - baselineSentiment;
    
    // Percentage rate of change relative to baseline scale range [-1, +1]
    const denominator = Math.abs(baselineSentiment) > 0.05 ? Math.abs(baselineSentiment) : 1;
    const driftRatePercent = parseFloat(((driftDelta / denominator) * 100).toFixed(1));

    let driftDirection: DriftDirection = "STABLE";
    let severity: DriftAlertSeverity = "LOW";

    if (coercionSpikeCount > 0 && currentSentiment > 0.3) {
      driftDirection = "COERCION_SPIKE";
      severity = coercionSpikeCount >= 3 ? "CRITICAL" : "HIGH";
    } else if (driftDelta <= cfg.declineThresholdDelta * 1.5) {
      driftDirection = "DECLINING";
      severity = "CRITICAL";
    } else if (driftDelta <= cfg.declineThresholdDelta) {
      driftDirection = "DECLINING";
      severity = "HIGH";
    } else if (driftDelta <= cfg.declineThresholdDelta / 2) {
      driftDirection = "DECLINING";
      severity = "MEDIUM";
    } else if (driftDelta >= 0.25) {
      driftDirection = "IMPROVING";
      severity = "LOW";
    } else {
      driftDirection = "STABLE";
      severity = "LOW";
    }

    return {
      baselineSentiment: parseFloat(baselineSentiment.toFixed(2)),
      currentSentiment: parseFloat(currentSentiment.toFixed(2)),
      driftDelta: parseFloat(driftDelta.toFixed(2)),
      driftRatePercent,
      driftDirection,
      severity,
    };
  }

  /**
   * Analyzes shifts in vocabulary between historical baseline and current feedback comments.
   */
  public extractLinguisticTermShifts(
    baselineComments: string[],
    currentComments: string[],
    topN = 6,
  ): LinguisticTermShift[] {
    const baselineTokens: string[] = [];
    baselineComments.forEach((c) => baselineTokens.push(...this.tokenizeText(c)));

    const currentTokens: string[] = [];
    currentComments.forEach((c) => currentTokens.push(...this.tokenizeText(c)));

    const totalBaseline = Math.max(baselineTokens.length, 1);
    const totalCurrent = Math.max(currentTokens.length, 1);

    const baselineCounts: Record<string, number> = {};
    baselineTokens.forEach((t) => (baselineCounts[t] = (baselineCounts[t] || 0) + 1));

    const currentCounts: Record<string, number> = {};
    currentTokens.forEach((t) => (currentCounts[t] = (currentCounts[t] || 0) + 1));

    const allTerms = new Set([...Object.keys(baselineCounts), ...Object.keys(currentCounts)]);
    const shifts: LinguisticTermShift[] = [];

    allTerms.forEach((term) => {
      const baseFreq = (baselineCounts[term] || 0) / totalBaseline;
      const currFreq = (currentCounts[term] || 0) / totalCurrent;

      const diff = currFreq - baseFreq;
      if (Math.abs(diff) < 0.005) return;

      const changePct =
        baseFreq > 0
          ? Math.round((diff / baseFreq) * 100)
          : Math.round(currFreq * 1000);

      const sentimentVal = analyzeSentiment(term);
      const polarity =
        sentimentVal > 0.1 ? "positive" : sentimentVal < -0.1 ? "negative" : "neutral";

      shifts.push({
        term,
        baselineFrequency: parseFloat(baseFreq.toFixed(3)),
        currentFrequency: parseFloat(currFreq.toFixed(3)),
        changePercentage: changePct,
        polarity,
        impactScore: parseFloat(Math.abs(diff * 100).toFixed(1)),
      });
    });

    return shifts.sort((a, b) => b.impactScore - a.impactScore).slice(0, topN);
  }

  /**
   * Detects coercion-induced artificial sentiment drift spike.
   */
  public detectCoercionSpike(points: LinguisticSentimentPoint[]): {
    isSpikeDetected: boolean;
    suspiciousPointCount: number;
  } {
    const suspiciousPoints = points.filter(
      (p) => p.coercionAnomalyScore >= 60 && p.sentimentScore >= 0.4 && p.rating >= 4,
    );

    return {
      isSpikeDetected: suspiciousPoints.length > 0,
      suspiciousPointCount: suspiciousPoints.length,
    };
  }

  /**
   * End-to-end evaluation for an event's linguistic sentiment drift.
   */
  public async evaluateEventLinguisticDrift(
    eventId: string,
    eventTitle = "Event",
    customConfig: DriftConfig = {},
  ): Promise<EventLinguisticSentimentDriftAnalysis> {
    const config = { ...this.defaultConfig, ...customConfig };

    try {
      const { data: feedbacks, error } = await supabase
        .from("event_feedbacks")
        .select(`
          id,
          rating,
          comment,
          sentiment_score,
          keystroke_anomaly_score,
          is_suspicious,
          created_at
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (error || !feedbacks || feedbacks.length === 0) {
        return this.generateOfflineFallbackAnalysis(eventId, eventTitle, config);
      }

      const points: LinguisticSentimentPoint[] = feedbacks.map((f: any) => {
        const text = f.comment || "";
        const computedSentiment =
          f.sentiment_score !== null && f.sentiment_score !== undefined
            ? Number(f.sentiment_score)
            : analyzeSentiment(text);

        return {
          id: f.id,
          timestamp: f.created_at || new Date().toISOString(),
          sentimentScore: computedSentiment,
          coercionAnomalyScore: Number(f.keystroke_anomaly_score || 0),
          rating: Number(f.rating || 3),
          feedbackText: text,
          keywords: this.tokenizeText(text).slice(0, 4),
        };
      });

      // Split into baseline (first half) and current (second half)
      const mid = Math.floor(points.length / 2);
      const baselinePoints = points.slice(0, mid);
      const currentPoints = points.slice(mid);

      const baselineScores = baselinePoints.map((p) => p.sentimentScore);
      const currentScores = currentPoints.map((p) => p.sentimentScore);

      const coercionCheck = this.detectCoercionSpike(currentPoints);

      const metrics = this.calculateSentimentMetrics(
        baselineScores,
        currentScores,
        coercionCheck.suspiciousPointCount,
        config,
      );

      const termShifts = this.extractLinguisticTermShifts(
        baselinePoints.map((p) => p.feedbackText),
        currentPoints.map((p) => p.feedbackText),
      );

      const { summaryMarkdown, recommendations } = this.generateDriftExecutiveSummary(
        eventTitle,
        metrics,
        termShifts,
        coercionCheck.isSpikeDetected,
      );

      return {
        eventId,
        eventTitle,
        ...metrics,
        totalFeedbackCount: points.length,
        coercionFlaggedCount: coercionCheck.suspiciousPointCount,
        isCoercionSpikeDetected: coercionCheck.isSpikeDetected,
        termShifts,
        timeline: points,
        executiveSummaryMarkdown: summaryMarkdown,
        recommendations,
        analyzedAt: new Date().toISOString(),
      };
    } catch (err) {
      return this.generateOfflineFallbackAnalysis(eventId, eventTitle, config);
    }
  }

  /**
   * Synthesizes markdown summary and actionable recommendations based on drift metrics.
   */
  public generateDriftExecutiveSummary(
    eventTitle: string,
    metrics: {
      baselineSentiment: number;
      currentSentiment: number;
      driftDelta: number;
      driftRatePercent: number;
      driftDirection: DriftDirection;
      severity: DriftAlertSeverity;
    },
    termShifts: LinguisticTermShift[],
    isCoercionSpike: boolean,
  ): { summaryMarkdown: string; recommendations: string[] } {
    let summaryMarkdown = `## Linguistic Sentiment Drift Report: ${eventTitle}\n\n`;

    if (isCoercionSpike) {
      summaryMarkdown += `⚠️ **CRITICAL ALERT: Coercion-Induced Sentiment Spike Detected**\n`;
      summaryMarkdown += `Recent feedback exhibits an artificial positive sentiment jump (+${metrics.driftDelta}) coupled with erratic keystroke dynamics. Reviews may be influenced or coerced.\n\n`;
    } else if (metrics.driftDirection === "DECLINING") {
      summaryMarkdown += `📉 **Warning: Negative Linguistic Drift Observed**\n`;
      summaryMarkdown += `Sentiment dropped by **${Math.abs(metrics.driftDelta)} points** (${metrics.driftRatePercent}%) compared to baseline expectations.\n\n`;
    } else if (metrics.driftDirection === "IMPROVING") {
      summaryMarkdown += `📈 **Positive Sentiment Momentum**\n`;
      summaryMarkdown += `Sentiment improved by **+${metrics.driftDelta} points** (${metrics.driftRatePercent}%) relative to baseline.\n\n`;
    } else {
      summaryMarkdown += `⚖️ **Stable Feedback Sentiment**\n`;
      summaryMarkdown += `Linguistic sentiment remains consistent with historical baseline expectations.\n\n`;
    }

    if (termShifts.length > 0) {
      summaryMarkdown += `### 🔤 Top Vocabulary Shifts\n`;
      termShifts.forEach((ts) => {
        const symbol = ts.changePercentage >= 0 ? "▲" : "▼";
        summaryMarkdown += `- **${ts.term}** (${ts.polarity}): ${symbol} ${Math.abs(ts.changePercentage)}% frequency shift\n`;
      });
    }

    const recommendations: string[] = [];
    if (isCoercionSpike) {
      recommendations.push("Inspect flagged suspicious reviews in SuspiciousFeedbackPanel.");
      recommendations.push("Audit feedback submission kiosks for supervisory coercion.");
    } else if (metrics.driftDirection === "DECLINING") {
      recommendations.push("Review recent attendee comments highlighting emerging complaints.");
      recommendations.push("Engage speaker/organizer team to address venue & content concerns.");
    } else if (metrics.driftDirection === "IMPROVING") {
      recommendations.push("Highlight positive attendee quotes in upcoming promotional channels.");
    } else {
      recommendations.push("Continue monitoring feedback streams for subtle shifts in tone.");
    }

    return { summaryMarkdown, recommendations };
  }

  /**
   * Generates structured fallback analysis when database queries fail or data is absent.
   */
  public generateOfflineFallbackAnalysis(
    eventId: string,
    eventTitle: string,
    config: DriftConfig = {},
  ): EventLinguisticSentimentDriftAnalysis {
    const mockTimeline: LinguisticSentimentPoint[] = [
      {
        id: "fb-1",
        timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
        sentimentScore: 0.65,
        coercionAnomalyScore: 15,
        rating: 5,
        feedbackText: "Great event, enjoyed the keynote and discussions!",
        keywords: ["great", "enjoyed", "keynote"],
      },
      {
        id: "fb-2",
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        sentimentScore: 0.4,
        coercionAnomalyScore: 20,
        rating: 4,
        feedbackText: "Good content, but check-in line was long and hot.",
        keywords: ["good", "line", "hot"],
      },
      {
        id: "fb-3",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        sentimentScore: -0.15,
        coercionAnomalyScore: 35,
        rating: 2,
        feedbackText: "Disappointed by venue noise and late start time.",
        keywords: ["disappointed", "noise", "late"],
      },
    ];

    const baselineScores = [0.65, 0.4];
    const currentScores = [-0.15];

    const metrics = this.calculateSentimentMetrics(baselineScores, currentScores, 0, config);
    const termShifts = this.extractLinguisticTermShifts(
      ["Great event, enjoyed the keynote and discussions!", "Good content, but check-in line was long."],
      ["Disappointed by venue noise and late start time."],
    );

    const { summaryMarkdown, recommendations } = this.generateDriftExecutiveSummary(
      eventTitle,
      metrics,
      termShifts,
      false,
    );

    return {
      eventId,
      eventTitle,
      ...metrics,
      totalFeedbackCount: mockTimeline.length,
      coercionFlaggedCount: 0,
      isCoercionSpikeDetected: false,
      termShifts,
      timeline: mockTimeline,
      executiveSummaryMarkdown: summaryMarkdown,
      recommendations,
      analyzedAt: new Date().toISOString(),
    };
  }
}

export const eventLinguisticSentimentDriftService = new EventLinguisticSentimentDriftService();
