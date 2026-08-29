import { describe, it, expect, beforeEach, vi } from "vitest";
import { SponsorAbTestingService } from "../sponsorAbTestingService";

describe("SponsorAbTestingService Unit Tests", () => {
  let service: SponsorAbTestingService;

  beforeEach(() => {
    service = new SponsorAbTestingService();
    service.clear();
    vi.restoreAllMocks();
  });

  it("creates an A/B test with Logo A and Logo B variants correctly", async () => {
    const test = await service.createAbTest({
      sponsorId: "sponsor-123",
      sponsorName: "Red Bull Campus",
      eventId: "event-456",
      title: "Red Bull Energy Zone Banner Test",
      logoAUrl: "https://cdn.example.com/redbull-logo-a.png",
      logoBUrl: "https://cdn.example.com/redbull-logo-b.png",
      targetUrlA: "https://redbull.com/campus-a",
      targetUrlB: "https://redbull.com/campus-b",
      sampleThreshold: 500,
    });

    expect(test.id).toBeDefined();
    expect(test.sponsorName).toBe("Red Bull Campus");
    expect(test.variantA.logoUrl).toBe("https://cdn.example.com/redbull-logo-a.png");
    expect(test.variantB.logoUrl).toBe("https://cdn.example.com/redbull-logo-b.png");
    expect(test.config.sampleThreshold).toBe(500);
    expect(test.config.trafficSplitA).toBe(50);
    expect(test.config.trafficSplitB).toBe(50);
    expect(test.winningVariant).toBeNull();
  });

  it("allocates variants 50/50 deterministically based on user id before conclusion", async () => {
    const test = await service.createAbTest({
      sponsorId: "sponsor-123",
      sponsorName: "Monster Energy",
      eventId: "event-789",
      title: "Monster Banner Test",
      logoAUrl: "https://cdn.example.com/monster-a.png",
      logoBUrl: "https://cdn.example.com/monster-b.png",
      targetUrlA: "https://monster.com/a",
      targetUrlB: "https://monster.com/b",
    });

    const variant1 = await service.getVariantForUser(test.id, "user_alice");
    const variant1Again = await service.getVariantForUser(test.id, "user_alice");
    expect(variant1).toBe(variant1Again);

    const variants = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const v = await service.getVariantForUser(test.id, `user_${i}`);
      variants.add(v);
    }
    // Both variants should be served across varied user IDs
    expect(variants.has("LOGO_A")).toBe(true);
    expect(variants.has("LOGO_B")).toBe(true);
  });

  it("tracks impressions and clicks and calculates accurate CTR", async () => {
    const test = await service.createAbTest({
      sponsorId: "sponsor-1",
      sponsorName: "TechCorp",
      eventId: "event-1",
      title: "TechCorp A/B",
      logoAUrl: "https://cdn.example.com/a.png",
      logoBUrl: "https://cdn.example.com/b.png",
      targetUrlA: "https://techcorp.com/a",
      targetUrlB: "https://techcorp.com/b",
      sampleThreshold: 100,
    });

    // Record 10 impressions and 2 clicks for Logo A (CTR 20%)
    for (let i = 0; i < 10; i++) {
      await service.trackEvent({ testId: test.id, variantKey: "LOGO_A", eventType: "impression" });
    }
    await service.trackEvent({ testId: test.id, variantKey: "LOGO_A", eventType: "click" });
    await service.trackEvent({ testId: test.id, variantKey: "LOGO_A", eventType: "click" });

    // Record 10 impressions and 4 clicks for Logo B (CTR 40%)
    for (let i = 0; i < 10; i++) {
      await service.trackEvent({ testId: test.id, variantKey: "LOGO_B", eventType: "impression" });
    }
    for (let i = 0; i < 4; i++) {
      await service.trackEvent({ testId: test.id, variantKey: "LOGO_B", eventType: "click" });
    }

    const updated = await service.getTestById(test.id);
    expect(updated?.metricsA.impressions).toBe(10);
    expect(updated?.metricsA.clicks).toBe(2);
    expect(updated?.metricsA.ctr).toBeCloseTo(20);

    expect(updated?.metricsB.impressions).toBe(10);
    expect(updated?.metricsB.clicks).toBe(4);
    expect(updated?.metricsB.ctr).toBeCloseTo(40);
  });

  it("automatically concludes test and routes 100% traffic to winning variant after sample threshold", async () => {
    const test = await service.createAbTest({
      sponsorId: "sponsor-3",
      sponsorName: "Campus Bank",
      eventId: "event-3",
      title: "Student Account Banner Test",
      logoAUrl: "https://cdn.example.com/bank-a.png",
      logoBUrl: "https://cdn.example.com/bank-b.png",
      targetUrlA: "https://bank.com/a",
      targetUrlB: "https://bank.com/b",
      sampleThreshold: 500,
      autoPromoteWinner: true,
    });

    // 250 impressions, 15 clicks for A (6% CTR)
    for (let i = 0; i < 250; i++) {
      await service.trackEvent({ testId: test.id, variantKey: "LOGO_A", eventType: "impression" });
      if (i < 15) {
        await service.trackEvent({ testId: test.id, variantKey: "LOGO_A", eventType: "click" });
      }
    }

    // 250 impressions, 45 clicks for B (18% CTR) -> reaching 500 total impressions
    for (let i = 0; i < 250; i++) {
      if (i < 45) {
        await service.trackEvent({ testId: test.id, variantKey: "LOGO_B", eventType: "click" });
      }
      await service.trackEvent({ testId: test.id, variantKey: "LOGO_B", eventType: "impression" });
    }

    const updated = await service.getTestById(test.id);
    expect(updated?.totalImpressions).toBe(500);
    expect(updated?.status).toBe("CONCLUDED");
    expect(updated?.winningVariant).toBe("LOGO_B");
    expect(updated?.config.trafficSplitA).toBe(0);
    expect(updated?.config.trafficSplitB).toBe(100);

    // Any subsequent user request gets routed 100% to LOGO_B
    const nextVariant = await service.getVariantForUser(test.id, "user_random_456");
    expect(nextVariant).toBe("LOGO_B");
  });

  it("computes statistical significance accurately", () => {
    // 500 impressions each, 10 clicks (2%) vs 30 clicks (6%)
    const stats = service.calculateStatisticalSignificance(500, 10, 500, 30);
    expect(stats.zScore).toBeLessThan(0);
    expect(stats.confidencePercent).toBeGreaterThanOrEqual(95);
    expect(stats.isSignificant).toBe(true);
  });
});
