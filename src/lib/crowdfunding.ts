import type { SupabaseClient } from "@supabase/supabase-js";

export interface CrowdfundingCampaign {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  target_amount_cents: number;
  current_amount_cents: number;
  end_date: string | null;
  status: "active" | "completed" | "cancelled";
  created_at: string;
}

export interface TopDonor {
  campaign_id: string;
  donor_id: string | null;
  display_name: string;
  is_anonymous: boolean;
  total_donated_cents: number;
  donation_count: number;
  last_donation_at: string;
}

export interface CampaignMatchActivity {
  match_id: string;
  campaign_id: string;
  requested_amount_cents: number;
  created_at: string;
  matched_at: string;
  source_display_name: string;
  alumni_display_name: string;
}

export interface CampaignMatchInvitation {
  campaign_id: string;
  requested_amount_cents: number;
  source_display_name: string;
}

/** Formats cents as a compact USD string, e.g. 512340 -> "$5,123.40". */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

/**
 * Percent of goal reached, capped at 100 so the progress bar never visually
 * breaks out of its container even when a campaign is overfunded.
 */
export function getCampaignProgressPercent(campaign: CrowdfundingCampaign): number {
  if (campaign.target_amount_cents <= 0) return 0;
  const raw = (campaign.current_amount_cents / campaign.target_amount_cents) * 100;
  return Math.min(100, Math.max(0, raw));
}

export function isCampaignEnded(campaign: CrowdfundingCampaign): boolean {
  if (campaign.status !== "active") return true;
  if (!campaign.end_date) return false;
  return new Date(campaign.end_date).getTime() < Date.now();
}

/** Fetches the club's currently active campaign (most recently created), if any. */
export async function fetchActiveCampaign(
  supabase: SupabaseClient,
  clubId: string,
): Promise<CrowdfundingCampaign | null> {
  const { data, error } = await supabase
    .from("crowdfunding_campaigns")
    .select("*")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as CrowdfundingCampaign | null;
}

export async function fetchTopDonors(
  supabase: SupabaseClient,
  campaignId: string,
  limit = 5,
): Promise<TopDonor[]> {
  const { data, error } = await supabase
    .from("campaign_top_donors")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("total_donated_cents", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as TopDonor[];
}

/** Loads public-safe alumni match activity for a campaign. */
export async function fetchCampaignMatchActivity(
  supabase: SupabaseClient,
  campaignId: string,
  limit = 10,
): Promise<CampaignMatchActivity[]> {
  const { data, error } = await supabase
    .from("campaign_match_activity")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("matched_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignMatchActivity[];
}

export async function fetchCampaignMatchInvitation(
  supabase: SupabaseClient,
  matchId: string,
): Promise<CampaignMatchInvitation | null> {
  const { data, error } = await supabase
    .rpc("get_campaign_match_invitation", { p_match_id: matchId })
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as CampaignMatchInvitation | null;
}

/** Kicks off Stripe Checkout for an ordinary donation or exact match gift. */
export async function createCampaignDonationCheckout(
  supabase: SupabaseClient,
  params: { campaignId: string; amountCents: number; isAnonymous: boolean; matchId?: string },
): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke("create-campaign-donation-checkout", {
    body: {
      campaignId: params.campaignId,
      amountCents: params.amountCents,
      isAnonymous: params.isAnonymous,
      matchId: params.matchId,
    },
  });

  if (error) throw new Error(error.message);
  if (!data?.url) throw new Error("Checkout session did not return a redirect URL.");
  return data as { url: string };
}
