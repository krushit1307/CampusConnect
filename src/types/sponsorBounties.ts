export interface Sponsor {
  id: string;
  event_id: string;
  company_name: string;
  logo_url: string | null;
  website_url: string | null;
  created_at: string;
  created_by: string;
}

export interface SponsorBounty {
  id: string;
  sponsor_id: string;
  title: string;
  description: string;
  points_reward: number;
  claim_code: string;
  max_claims: number;
  current_claims: number;
  created_at: string;
  expires_at: string | null;
}

export interface SponsorBountyWithSponsor extends SponsorBounty {
  sponsors: Sponsor;
}

export interface SponsorBountyClaim {
  id: string;
  bounty_id: string;
  user_id: string;
  claimed_at: string;
}

export interface ClaimBountyResponse {
  success: boolean;
  points_awarded: number;
}
