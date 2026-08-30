/**
 * Data Models & Types for Dynamic Sponsor Logo PPP Adjuster / Equity Swaps (Issue #5140).
 */

export type EquitySwapState =
  | "OFFERED"
  | "ACCEPTED_BY_FOUNDER"
  | "AGREEMENT_GENERATED"
  | "FOUNDER_SIGNED"
  | "SPONSOR_SIGNED"
  | "FINALIZED"
  | "BLOCKCHAIN_RECORDED"
  | "LICENSE_PROVISIONED"
  | "ACTIVE"
  | "SIGNATURE_FAILED"
  | "BLOCKCHAIN_FAILED"
  | "PROVISIONING_FAILED"
  | "CANCELLED"
  | "EXPIRED";

export type EquityInstrumentType = "SAFE" | "WARRANT" | "DIRECT_SHARES";

export interface SponsorPppOffer {
  id: string;
  sponsorId: string;
  sponsorName: string;
  sponsorLogoUrl?: string;
  softwareLicenseName: string;
  softwareCategory: "cloud_infrastructure" | "developer_tools" | "analytics" | "ai_suite";
  retailUsdValue: number;
  /** Purchasing Power Parity adjustment factor (e.g. 0.40 to 1.0) */
  pppAdjustmentFactor: number;
  /** Adjusted software license value in USD */
  adjustedUsdValue: number;
  /** Agreed equity percentage trade-off (e.g., 0.1% to 2.0%) */
  equityPercentage: number;
  equityInstrument: EquityInstrumentType;
  licenseDurationMonths: number;
  isAvailable: boolean;
  description: string;
}

export interface SignatureRecord {
  signerId: string;
  signerName: string;
  signerRole: "founder" | "sponsor";
  signedAtIso: string;
  ipAddress: string;
  signatureHash: string;
}

export interface BlockchainAnchorRecord {
  transactionHash: string;
  network: "polygon-mainnet" | "polygon-amoy-testnet";
  blockNumber: number;
  anchoredAtIso: string;
  contractAddress: string;
  documentSha256Hash: string;
}

export interface ProvisionedLicenseEntitlement {
  licenseKey: string;
  licenseUrl: string;
  activatedAtIso: string;
  expiresAtIso: string;
  seatsCount: number;
  supportTier: "enterprise" | "priority";
}

export interface EquitySwapAgreement {
  id: string;
  offerId: string;
  startupId: string;
  startupName: string;
  founderId: string;
  founderName: string;
  sponsorId: string;
  sponsorName: string;
  status: EquitySwapState;
  softwareLicenseName: string;
  adjustedUsdValue: number;
  equityPercentage: number;
  equityInstrument: EquityInstrumentType;
  agreementText: string;
  documentSha256Hash: string;
  founderSignature?: SignatureRecord;
  sponsorSignature?: SignatureRecord;
  blockchainAnchor?: BlockchainAnchorRecord;
  licenseEntitlement?: ProvisionedLicenseEntitlement;
  createdAtIso: string;
  updatedAtIso: string;
  finalizedAtIso?: string;
}

export interface CreateOfferInput {
  sponsorId: string;
  sponsorName: string;
  softwareLicenseName: string;
  softwareCategory: "cloud_infrastructure" | "developer_tools" | "analytics" | "ai_suite";
  retailUsdValue: number;
  regionalPppFactor?: number;
  equityPercentage: number;
  equityInstrument?: EquityInstrumentType;
  licenseDurationMonths?: number;
  description: string;
}
