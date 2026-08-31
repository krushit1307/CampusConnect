export type VariantType = "LOGO_A" | "LOGO_B";

export type AbTestStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "CONCLUDED";

export interface SponsorLogoVariant {
  id: string;
  variantKey: VariantType;
  logoUrl: string;
  altText: string;
  tagline?: string;
  backgroundColor?: string;
  targetUrl: string;
  createdAt: string;
}

export interface AbVariantMetrics {
  impressions: number;
  clicks: number;
  ctr: number; // percentage (0 - 100)
  conversionRate?: number;
  lastInteractionAt?: string;
}

export interface SponsorAbTestConfig {
  sampleThreshold: number; // default 500 impressions total
  confidenceThresholdPercent: number; // default 95%
  autoPromoteWinner: boolean; // default true
  trafficSplitA: number; // default 50 (50%)
  trafficSplitB: number; // default 50 (50%)
  minDifferencePercent?: number; // minimum CTR diff to declare winner
}

export interface SponsorAbTest {
  id: string;
  sponsorId: string;
  sponsorName: string;
  eventId: string;
  title: string;
  status: AbTestStatus;
  variantA: SponsorLogoVariant;
  variantB: SponsorLogoVariant;
  metricsA: AbVariantMetrics;
  metricsB: AbVariantMetrics;
  totalImpressions: number;
  totalClicks: number;
  winningVariant?: VariantType | null;
  winnerDeclaredAt?: string | null;
  config: SponsorAbTestConfig;
  createdAt: string;
  updatedAt: string;
}

export interface AbTestEvaluationResult {
  testId: string;
  totalImpressions: number;
  thresholdReached: boolean;
  variantA: {
    impressions: number;
    clicks: number;
    ctr: number;
  };
  variantB: {
    impressions: number;
    clicks: number;
    ctr: number;
  };
  ctrDifference: number;
  zScore: number;
  confidencePercent: number;
  isStatisticallySignificant: boolean;
  recommendedWinner: VariantType | "INCONCLUSIVE" | "TIE";
  actionTaken: "WINNER_PROMOTED" | "TEST_CONTINUING" | "MANUAL_INTERVENTION_NEEDED";
  winningVariant?: VariantType | null;
}

export interface TrackEventPayload {
  testId: string;
  variantKey: VariantType;
  eventType: "impression" | "click";
  userId?: string;
  sessionId?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateAbTestInput {
  sponsorId: string;
  sponsorName: string;
  eventId: string;
  title: string;
  logoAUrl: string;
  logoBUrl: string;
  altTextA?: string;
  altTextB?: string;
  targetUrlA: string;
  targetUrlB: string;
  taglineA?: string;
  taglineB?: string;
  sampleThreshold?: number;
  autoPromoteWinner?: boolean;
}
