import { supabase } from "../lib/supabase/client";
import type {
  Sponsor,
  SponsorBounty,
  SponsorBountyWithSponsor,
  ClaimBountyResponse,
} from "../types/sponsorBounties";

export const SponsorBountyService = {
  /**
   * Fetch all sponsors for a given event ID
   */
  async getSponsorsByEventId(eventId: string): Promise<Sponsor[]> {
    const { data, error } = await supabase
      .from("sponsors")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching sponsors:", error);
      throw error;
    }
    return data as Sponsor[];
  },

  /**
   * Fetch a single sponsor with their bounties
   */
  async getBountiesBySponsorId(sponsorId: string): Promise<SponsorBounty[]> {
    const { data, error } = await supabase
      .from("sponsor_bounties")
      .select("*")
      .eq("sponsor_id", sponsorId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching sponsor bounties:", error);
      throw error;
    }
    return data as SponsorBounty[];
  },

  /**
   * Fetch all bounties for a given event ID by joining sponsors
   */
  async getBountiesByEventId(eventId: string): Promise<SponsorBountyWithSponsor[]> {
    // In Supabase, if we want all bounties belonging to an event, we need an inner join or nested select
    const { data, error } = await supabase
      .from("sponsor_bounties")
      .select("*, sponsors!inner(*)")
      .eq("sponsors.event_id", eventId);

    if (error) {
      console.error("Error fetching event bounties:", error);
      throw error;
    }
    return data as unknown as SponsorBountyWithSponsor[];
  },

  /**
   * Call the RPC to claim a bounty using the claim code
   */
  async claimBounty(claimCode: string): Promise<ClaimBountyResponse> {
    const { data, error } = await supabase.rpc("claim_sponsor_bounty", {
      p_claim_code: claimCode,
    });

    if (error) {
      console.error("Error claiming sponsor bounty:", error);
      throw error;
    }
    return data as ClaimBountyResponse;
  },

  /**
   * Sponsor Analytics Dashboard insights - getting all claims for bounties owned by the current sponsor.
   */
  async getSponsorAnalytics(sponsorId: string) {
    // Requires joining Claims, Bounties, and Profiles
    const { data, error } = await supabase
      .from("sponsor_bounty_claims")
      .select(
        `
        id,
        claimed_at,
        sponsor_bounties!inner (
          id, title, sponsor_id
        ),
        profiles (
          id, first_name, last_name, avatar_url, college
        )
      `,
      )
      .eq("sponsor_bounties.sponsor_id", sponsorId)
      .order("claimed_at", { ascending: false });

    if (error) {
      console.error("Error fetching sponsor analytics:", error);
      throw error;
    }
    return data;
  },
};
