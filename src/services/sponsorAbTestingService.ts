import {
  SponsorAbTest,
  CreateAbTestInput,
  VariantType,
  AbTestEvaluationResult,
  TrackEventPayload,
  AbVariantMetrics,
} from "../types/sponsorAbTesting";
import { getRedisClient } from "../lib/redis/client";

export class SponsorAbTestingService {
  private inMemoryTests: Map<string, SponsorAbTest> = new Map();
  private inMemoryRedisStore: Map<string, number> = new Map();

  /**
   * Generates a Redis hash key for A/B testing metrics
   */
  private getMetricKey(
    testId: string,
    variant: VariantType,
    metric: "impressions" | "clicks",
  ): string {
    return `ab_test:${testId}:${variant}:${metric}`;
  }

  /**
   * Creates a new A/B test with Logo A and Logo B variants
   */
  public async createAbTest(input: CreateAbTestInput): Promise<SponsorAbTest> {
    const testId = `ab_test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    const newTest: SponsorAbTest = {
      id: testId,
      sponsorId: input.sponsorId,
      sponsorName: input.sponsorName,
      eventId: input.eventId,
      title: input.title || `Sponsor Campaign A/B Test - ${input.sponsorName}`,
      status: "ACTIVE",
      variantA: {
        id: `${testId}_var_a`,
        variantKey: "LOGO_A",
        logoUrl: input.logoAUrl,
        altText: input.altTextA || `${input.sponsorName} - Variant A`,
        tagline: input.taglineA,
        targetUrl: input.targetUrlA,
        createdAt: now,
      },
      variantB: {
        id: `${testId}_var_b`,
        variantKey: "LOGO_B",
        logoUrl: input.logoBUrl,
        altText: input.altTextB || `${input.sponsorName} - Variant B`,
        tagline: input.taglineB,
        targetUrl: input.targetUrlB,
        createdAt: now,
      },
      metricsA: {
        impressions: 0,
        clicks: 0,
        ctr: 0,
      },
      metricsB: {
        impressions: 0,
        clicks: 0,
        ctr: 0,
      },
      totalImpressions: 0,
      totalClicks: 0,
      winningVariant: null,
      winnerDeclaredAt: null,
      config: {
        sampleThreshold: input.sampleThreshold || 500,
        confidenceThresholdPercent: 95,
        autoPromoteWinner: input.autoPromoteWinner !== undefined ? input.autoPromoteWinner : true,
        trafficSplitA: 50,
        trafficSplitB: 50,
        minDifferencePercent: 0.1,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.inMemoryTests.set(testId, newTest);

    // Initialize Redis counters
    try {
      const client = getRedisClient();
      if (client && client.status === "ready") {
        await client.set(this.getMetricKey(testId, "LOGO_A", "impressions"), "0");
        await client.set(this.getMetricKey(testId, "LOGO_A", "clicks"), "0");
        await client.set(this.getMetricKey(testId, "LOGO_B", "impressions"), "0");
        await client.set(this.getMetricKey(testId, "LOGO_B", "clicks"), "0");
      }
    } catch {
      // Fallback in-memory
      this.inMemoryRedisStore.set(this.getMetricKey(testId, "LOGO_A", "impressions"), 0);
      this.inMemoryRedisStore.set(this.getMetricKey(testId, "LOGO_A", "clicks"), 0);
      this.inMemoryRedisStore.set(this.getMetricKey(testId, "LOGO_B", "impressions"), 0);
      this.inMemoryRedisStore.set(this.getMetricKey(testId, "LOGO_B", "clicks"), 0);
    }

    return newTest;
  }

  /**
   * Resolves which variant to serve to a user or session.
   * If a winner is declared, 100% of traffic is routed to the winning variant.
   * Otherwise, allocates 50/50 randomly or deterministically.
   */
  public async getVariantForUser(testId: string, userOrSessionId?: string): Promise<VariantType> {
    const test = this.inMemoryTests.get(testId);
    if (!test) {
      return "LOGO_A";
    }

    // If test is concluded with a winner, route 100% to winner
    if (test.winningVariant) {
      return test.winningVariant;
    }

    // If deterministic seed provided (user ID or session hash)
    if (userOrSessionId) {
      let hash = 0;
      for (let i = 0; i < userOrSessionId.length; i++) {
        hash = (hash << 5) - hash + userOrSessionId.charCodeAt(i);
        hash |= 0;
      }
      const normalized = Math.abs(hash) % 100;
      return normalized < test.config.trafficSplitA ? "LOGO_A" : "LOGO_B";
    }

    // Pseudo-random 50/50 split
    const rand = Math.random() * 100;
    return rand < test.config.trafficSplitA ? "LOGO_A" : "LOGO_B";
  }

  /**
   * Increments impression or click in Redis and checks threshold for auto-evaluation
   */
  public async trackEvent(payload: TrackEventPayload): Promise<AbVariantMetrics> {
    const { testId, variantKey, eventType } = payload;
    const key = this.getMetricKey(
      testId,
      variantKey,
      eventType === "impression" ? "impressions" : "clicks",
    );

    let count = 0;
    try {
      const client = getRedisClient();
      if (client && client.status === "ready") {
        count = await client.incr(key);
      } else {
        const current = this.inMemoryRedisStore.get(key) || 0;
        count = current + 1;
        this.inMemoryRedisStore.set(key, count);
      }
    } catch {
      const current = this.inMemoryRedisStore.get(key) || 0;
      count = current + 1;
      this.inMemoryRedisStore.set(key, count);
    }

    // Sync metrics with in-memory test object
    const test = this.inMemoryTests.get(testId);
    if (test) {
      const metrics = variantKey === "LOGO_A" ? test.metricsA : test.metricsB;
      if (eventType === "impression") {
        metrics.impressions = count;
      } else {
        metrics.clicks = count;
      }

      // Recalculate CTR
      metrics.ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
      metrics.lastInteractionAt = new Date().toISOString();

      test.totalImpressions = test.metricsA.impressions + test.metricsB.impressions;
      test.totalClicks = test.metricsA.clicks + test.metricsB.clicks;
      test.updatedAt = new Date().toISOString();

      // Check if 500 impressions threshold is reached for auto-winner declaration
      if (
        test.config.autoPromoteWinner &&
        !test.winningVariant &&
        test.totalImpressions >= test.config.sampleThreshold
      ) {
        await this.evaluateAndPromoteWinner(testId);
      }

      return metrics;
    }

    return {
      impressions: eventType === "impression" ? count : 0,
      clicks: eventType === "click" ? count : 0,
      ctr: 0,
    };
  }

  /**
   * Computes Z-score and statistical confidence for two-proportion A/B test
   */
  public calculateStatisticalSignificance(
    impressionsA: number,
    clicksA: number,
    impressionsB: number,
    clicksB: number,
  ): { zScore: number; confidencePercent: number; isSignificant: boolean } {
    if (impressionsA === 0 || impressionsB === 0) {
      return { zScore: 0, confidencePercent: 0, isSignificant: false };
    }

    const pA = clicksA / impressionsA;
    const pB = clicksB / impressionsB;

    const pooledP = (clicksA + clicksB) / (impressionsA + impressionsB);
    const standardError = Math.sqrt(
      pooledP * (1 - pooledP) * (1 / impressionsA + 1 / impressionsB),
    );

    if (standardError === 0) {
      return { zScore: 0, confidencePercent: 0, isSignificant: false };
    }

    const zScore = (pA - pB) / standardError;
    const absZ = Math.abs(zScore);

    // Approximate cumulative normal distribution function
    // For Z=1.96, confidence is ~95%
    let confidence = 0;
    if (absZ >= 2.58) confidence = 99.0;
    else if (absZ >= 1.96) confidence = 95.0;
    else if (absZ >= 1.64) confidence = 90.0;
    else if (absZ >= 1.28) confidence = 80.0;
    else confidence = Math.min(Math.round(absZ * 45), 79);

    return {
      zScore: parseFloat(zScore.toFixed(4)),
      confidencePercent: confidence,
      isSignificant: absZ >= 1.64, // 90%+ confidence considered statistically significant
    };
  }

  /**
   * Evaluates the A/B test metrics, calculates CTR, declares winner and adjusts traffic to 100%
   */
  public async evaluateAndPromoteWinner(testId: string): Promise<AbTestEvaluationResult> {
    const test = this.inMemoryTests.get(testId);
    if (!test) {
      throw new Error(`A/B Test with ID ${testId} not found.`);
    }

    const impA = test.metricsA.impressions;
    const clkA = test.metricsA.clicks;
    const ctrA = impA > 0 ? (clkA / impA) * 100 : 0;

    const impB = test.metricsB.impressions;
    const clkB = test.metricsB.clicks;
    const ctrB = impB > 0 ? (clkB / impB) * 100 : 0;

    const totalImp = impA + impB;
    const thresholdReached = totalImp >= test.config.sampleThreshold;

    const stats = this.calculateStatisticalSignificance(impA, clkA, impB, clkB);
    const ctrDiff = Math.abs(ctrA - ctrB);

    let recommendedWinner: VariantType | "INCONCLUSIVE" | "TIE" = "INCONCLUSIVE";
    let actionTaken: "WINNER_PROMOTED" | "TEST_CONTINUING" | "MANUAL_INTERVENTION_NEEDED" =
      "TEST_CONTINUING";

    if (ctrA > ctrB) {
      recommendedWinner = "LOGO_A";
    } else if (ctrB > ctrA) {
      recommendedWinner = "LOGO_B";
    } else {
      recommendedWinner = "TIE";
    }

    if (thresholdReached && recommendedWinner !== "TIE" && recommendedWinner !== "INCONCLUSIVE") {
      test.winningVariant = recommendedWinner;
      test.winnerDeclaredAt = new Date().toISOString();
      test.status = "CONCLUDED";

      // Route 100% of future traffic to winner
      if (recommendedWinner === "LOGO_A") {
        test.config.trafficSplitA = 100;
        test.config.trafficSplitB = 0;
      } else {
        test.config.trafficSplitA = 0;
        test.config.trafficSplitB = 100;
      }

      actionTaken = "WINNER_PROMOTED";
      test.updatedAt = new Date().toISOString();
    } else if (!thresholdReached) {
      actionTaken = "TEST_CONTINUING";
    } else {
      actionTaken = "MANUAL_INTERVENTION_NEEDED";
    }

    return {
      testId,
      totalImpressions: totalImp,
      thresholdReached,
      variantA: {
        impressions: impA,
        clicks: clkA,
        ctr: parseFloat(ctrA.toFixed(2)),
      },
      variantB: {
        impressions: impB,
        clicks: clkB,
        ctr: parseFloat(ctrB.toFixed(2)),
      },
      ctrDifference: parseFloat(ctrDiff.toFixed(2)),
      zScore: stats.zScore,
      confidencePercent: stats.confidencePercent,
      isStatisticallySignificant: stats.isSignificant,
      recommendedWinner,
      actionTaken,
      winningVariant: test.winningVariant,
    };
  }

  /**
   * Manually sets the winning variant or overrides traffic split
   */
  public async setManualWinner(testId: string, winner: VariantType): Promise<SponsorAbTest> {
    const test = this.inMemoryTests.get(testId);
    if (!test) {
      throw new Error(`A/B Test with ID ${testId} not found.`);
    }

    test.winningVariant = winner;
    test.winnerDeclaredAt = new Date().toISOString();
    test.status = "CONCLUDED";

    if (winner === "LOGO_A") {
      test.config.trafficSplitA = 100;
      test.config.trafficSplitB = 0;
    } else {
      test.config.trafficSplitA = 0;
      test.config.trafficSplitB = 100;
    }

    test.updatedAt = new Date().toISOString();
    return test;
  }

  /**
   * Retrieves test details by test ID
   */
  public async getTestById(testId: string): Promise<SponsorAbTest | null> {
    return this.inMemoryTests.get(testId) || null;
  }

  /**
   * Lists all A/B tests for a specific event
   */
  public async listTestsByEvent(eventId: string): Promise<SponsorAbTest[]> {
    return Array.from(this.inMemoryTests.values()).filter((t) => t.eventId === eventId);
  }

  /**
   * Clears internal state (useful for test suites)
   */
  public clear(): void {
    this.inMemoryTests.clear();
    this.inMemoryRedisStore.clear();
  }
}

export const sponsorAbTestingService = new SponsorAbTestingService();
