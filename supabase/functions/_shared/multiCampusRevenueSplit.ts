export const AFFILIATE_SOURCE_METADATA_KEY = "affiliate_source";

export const HOST_CLUB_SHARE = 0.85;
export const AFFILIATE_SHARE = 0.1;
export const PLATFORM_FEE_SHARE = 0.05;

export type MultiCampusRevenueSplit = {
  grossCents: number;
  hostClubCents: number;
  affiliateCents: number;
  platformFeeCents: number;
};

export function shouldApplyAffiliateSplit(
  buyerInstanceId: string | null | undefined,
  hostInstanceId: string | null | undefined,
): boolean {
  const buyer = (buyerInstanceId || "").trim();
  const host = (hostInstanceId || "").trim();
  return Boolean(buyer && host && buyer !== host);
}

export function calculateMultiCampusRevenueSplit(grossCents: number): MultiCampusRevenueSplit {
  const safeGross = Math.max(0, Math.floor(grossCents));
  const platformFeeCents = Math.round(safeGross * PLATFORM_FEE_SHARE);
  const affiliateCents = Math.round(safeGross * AFFILIATE_SHARE);
  const hostClubCents = safeGross - platformFeeCents - affiliateCents;
  return { grossCents: safeGross, hostClubCents, affiliateCents, platformFeeCents };
}

/** Destination charge: platform holds 5% + 10% affiliate, host club receives 85%. */
export function formatAffiliateConnectCharge(
  split: MultiCampusRevenueSplit,
  hostStripeAccountId: string,
) {
  if (!hostStripeAccountId) {
    throw new Error("Host club Stripe Connect account is required for affiliate routing.");
  }
  return {
    applicationFeeAmountCents: split.platformFeeCents + split.affiliateCents,
    destinationAccountId: hostStripeAccountId,
    affiliateTransferCents: split.affiliateCents,
  };
}

export function buildAffiliateSourceMetadata(buyerInstanceId: string): Record<string, string> {
  return { [AFFILIATE_SOURCE_METADATA_KEY]: buyerInstanceId };
}
