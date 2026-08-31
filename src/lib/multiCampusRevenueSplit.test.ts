import { describe, expect, it } from "vitest";
import {
  AFFILIATE_SOURCE_METADATA_KEY,
  buildAffiliateSourceMetadata,
  calculateMultiCampusRevenueSplit,
  formatAffiliateConnectCharge,
  shouldApplyAffiliateSplit,
} from "./multiCampusRevenueSplit";

describe("multi-campus shared revenue splitter (#4726)", () => {
  it("splits $1,000 as 85% host club, 10% affiliate, 5% platform", () => {
    const split = calculateMultiCampusRevenueSplit(100_000);
    expect(split.hostClubCents).toBe(85_000);
    expect(split.affiliateCents).toBe(10_000);
    expect(split.platformFeeCents).toBe(5_000);
  });

  it("tags the PaymentIntent with affiliate_source = Harvard_Instance_ID", () => {
    expect(buildAffiliateSourceMetadata("Harvard_Instance_ID")).toEqual({
      [AFFILIATE_SOURCE_METADATA_KEY]: "Harvard_Instance_ID",
    });
  });

  it("only routes the affiliate cut when buyer and host campuses differ", () => {
    expect(shouldApplyAffiliateSplit("Harvard_Instance_ID", "MIT_Instance_ID")).toBe(true);
    expect(shouldApplyAffiliateSplit("MIT_Instance_ID", "MIT_Instance_ID")).toBe(false);
    expect(shouldApplyAffiliateSplit(null, "MIT_Instance_ID")).toBe(false);
  });

  it("holds platform fee plus affiliate cut on the platform, destination is the host club", () => {
    const charge = formatAffiliateConnectCharge(
      calculateMultiCampusRevenueSplit(100_000),
      "acct_mit_club",
    );
    expect(charge.destinationAccountId).toBe("acct_mit_club");
    expect(charge.applicationFeeAmountCents).toBe(15_000);
    expect(charge.affiliateTransferCents).toBe(10_000);
  });
});
