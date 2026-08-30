import { describe, it, expect } from "vitest";
import { AgreementGenerator } from "../agreementGenerator";
import { EquitySwapAgreement, SponsorPppOffer } from "@/types/equitySwap";

describe("AgreementGenerator", () => {
  const generator = new AgreementGenerator();

  const mockOffer: SponsorPppOffer = {
    id: "offer_1",
    sponsorId: "sp_aws",
    sponsorName: "AWS Cloud for Startups",
    softwareLicenseName: "AWS Enterprise Cloud Credits",
    softwareCategory: "cloud_infrastructure",
    retailUsdValue: 100000,
    pppAdjustmentFactor: 0.4,
    adjustedUsdValue: 40000,
    equityPercentage: 0.5,
    equityInstrument: "SAFE",
    licenseDurationMonths: 12,
    isAvailable: true,
    description: "100k AWS Credits",
  };

  it("generates structured SAFE agreement text containing PPP terms and party names", () => {
    const text = generator.generateAgreementText(
      mockOffer,
      "startup_101",
      "Apex AI Labs",
      "user_founder_1",
      "Alice Chen",
    );

    expect(text).toContain("SIMPLE AGREEMENT FOR FUTURE EQUITY");
    expect(text).toContain("Apex AI Labs");
    expect(text).toContain("Alice Chen");
    expect(text).toContain("AWS Cloud for Startups");
    expect(text).toContain("0.50%");
    expect(text).toContain("$40000.00 USD");
  });

  it("computes deterministic SHA-256 hash for document immutability", async () => {
    const text = "Sample SAFE Agreement Content String";
    const hash1 = await generator.computeSha256Hash(text);
    const hash2 = await generator.computeSha256Hash(text);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBeGreaterThan(10);
  });

  it("verifies immutability when agreement text remains unchanged", async () => {
    const text = "SAFE Contract Body";
    const hash = await generator.computeSha256Hash(text);

    const agreement: Partial<EquitySwapAgreement> = {
      agreementText: text,
      documentSha256Hash: hash,
    };

    const isImmutable = await generator.verifyImmutability(agreement as EquitySwapAgreement);
    expect(isImmutable).toBe(true);
  });
});
