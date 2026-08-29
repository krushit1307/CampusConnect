import { describe, it, expect, beforeEach } from "vitest";
import { SponsorAbTestingService } from "../../src/services/sponsorAbTestingService";

describe("SponsorAbTestingEngine Integration Tests", () => {
  let engine: SponsorAbTestingService;

  beforeEach(() => {
    engine = new SponsorAbTestingService();
    engine.clear();
  });

  it("handles multi-tenant A/B tests across separate events without state collision", async () => {
    const test1 = await engine.createAbTest({
      sponsorId: "sponsor-alpha",
      sponsorName: "Alpha Coffee",
      eventId: "hackathon-2026",
      title: "Coffee Booth Banner Test",
      logoAUrl: "https://cdn.alpha.com/a.svg",
      logoBUrl: "https://cdn.alpha.com/b.svg",
      targetUrlA: "https://alpha.com/hack1",
      targetUrlB: "https://alpha.com/hack2",
      sampleThreshold: 300,
    });

    const test2 = await engine.createAbTest({
      sponsorId: "sponsor-beta",
      sponsorName: "Beta Cloud",
      eventId: "hackathon-2026",
      title: "Cloud Credits Banner Test",
      logoAUrl: "https://cdn.beta.com/a.svg",
      logoBUrl: "https://cdn.beta.com/b.svg",
      targetUrlA: "https://beta.com/credits-a",
      targetUrlB: "https://beta.com/credits-b",
      sampleThreshold: 400,
    });

    const testsForEvent = await engine.listTestsByEvent("hackathon-2026");
    expect(testsForEvent).toHaveLength(2);

    // Track events on Test 1
    await engine.trackEvent({ testId: test1.id, variantKey: "LOGO_A", eventType: "impression" });
    await engine.trackEvent({ testId: test1.id, variantKey: "LOGO_A", eventType: "click" });

    // Verify Test 2 metrics remain zero
    const stateTest2 = await engine.getTestById(test2.id);
    expect(stateTest2?.metricsA.impressions).toBe(0);
    expect(stateTest2?.metricsA.clicks).toBe(0);

    const stateTest1 = await engine.getTestById(test1.id);
    expect(stateTest1?.metricsA.impressions).toBe(1);
    expect(stateTest1?.metricsA.clicks).toBe(1);
    expect(stateTest1?.metricsA.ctr).toBe(100);
  });

  it("allows organizers to override and promote manual winner before sample threshold", async () => {
    const test = await engine.createAbTest({
      sponsorId: "sponsor-gamma",
      sponsorName: "Gamma Fitness",
      eventId: "sports-fest-2026",
      title: "Gym Pass Promo",
      logoAUrl: "https://gamma.com/logo1.png",
      logoBUrl: "https://gamma.com/logo2.png",
      targetUrlA: "https://gamma.com/pass1",
      targetUrlB: "https://gamma.com/pass2",
      sampleThreshold: 1000,
    });

    // Record only 50 impressions
    for (let i = 0; i < 50; i++) {
      await engine.trackEvent({ testId: test.id, variantKey: "LOGO_A", eventType: "impression" });
    }

    const manualWinner = await engine.setManualWinner(test.id, "LOGO_A");
    expect(manualWinner.winningVariant).toBe("LOGO_A");
    expect(manualWinner.status).toBe("CONCLUDED");
    expect(manualWinner.config.trafficSplitA).toBe(100);
    expect(manualWinner.config.trafficSplitB).toBe(0);

    const variant = await engine.getVariantForUser(test.id, "any_attendee");
    expect(variant).toBe("LOGO_A");
  });
});
