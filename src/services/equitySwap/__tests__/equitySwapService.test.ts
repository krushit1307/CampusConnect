import { describe, it, expect, beforeEach } from "vitest";
import { EquitySwapService } from "../equitySwapService";

describe("EquitySwapService", () => {
  let service: EquitySwapService;

  beforeEach(() => {
    service = new EquitySwapService();
  });

  it("loads seeded sponsor PPP software offers with adjusted valuation", () => {
    const offers = service.getOffers();
    expect(offers.length).toBeGreaterThanOrEqual(3);

    const awsOffer = offers.find((o) => o.sponsorId === "sp_aws");
    expect(awsOffer).toBeDefined();
    expect(awsOffer?.adjustedUsdValue).toBe(40000); // 100k * 0.40
    expect(awsOffer?.equityPercentage).toBe(0.5);
  });

  it("creates a new custom sponsor PPP offer", () => {
    const offer = service.createPppOffer({
      sponsorId: "sp_datadog",
      sponsorName: "Datadog HQ",
      softwareLicenseName: "Datadog Enterprise APM",
      softwareCategory: "analytics",
      retailUsdValue: 30000,
      regionalPppFactor: 0.5,
      equityPercentage: 0.3,
      description: "APM & Observability suite",
    });

    expect(offer.adjustedUsdValue).toBe(15000);
    expect(service.getOfferById(offer.id)).not.toBeNull();
  });

  it("advances state machine upon founder acceptance and dual signing", async () => {
    const offers = service.getOffers();
    const targetOffer = offers[0];

    // 1. Founder accepts offer & generates agreement
    const agreement = await service.acceptOfferAndGenerateAgreement(
      targetOffer.id,
      "st_cyber_01",
      "Quantum CyberSec",
      "f_alice",
      "Alice Vance",
    );

    expect(agreement.status).toBe("AGREEMENT_GENERATED");
    expect(agreement.documentSha256Hash).toBeDefined();

    // 2. Founder signs agreement
    const founderSigned = await service.signAgreement(
      agreement.id,
      "f_alice",
      "Alice Vance",
      "founder",
    );
    expect(founderSigned.status).toBe("FOUNDER_SIGNED");
    expect(founderSigned.founderSignature).toBeDefined();

    // 3. Sponsor signs agreement => triggers FINALIZED -> BLOCKCHAIN_RECORDED -> ACTIVE
    const finalized = await service.signAgreement(
      agreement.id,
      "sp_aws",
      "AWS Sponsor Rep",
      "sponsor",
    );

    expect(finalized.status).toBe("ACTIVE");
    expect(finalized.blockchainAnchor).toBeDefined();
    expect(finalized.blockchainAnchor?.transactionHash).toContain("0x");
    expect(finalized.licenseEntitlement).toBeDefined();
    expect(finalized.licenseEntitlement?.licenseKey).toContain("EQUITY");
  });

  it("rejects invalid equity percentage inputs", () => {
    expect(() =>
      service.createPppOffer({
        sponsorId: "sp_bad",
        sponsorName: "Bad Offer",
        softwareLicenseName: "Invalid License",
        softwareCategory: "cloud_infrastructure",
        retailUsdValue: 1000,
        equityPercentage: -1,
        description: "Invalid",
      }),
    ).toThrow();
  });
});
