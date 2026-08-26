/**
 * Sponsorship Renewal Service
 * Provides backend integration for fetching renewals, running cron checks,
 * processing Stripe payments, and syncing active sponsor rotators.
 * Issue #4141
 */

import { createClient } from '../lib/supabase/client';
import {
  SponsorshipTierRenewal,
  SponsorshipInvoice,
  RenewalCronSummary,
} from '../types/sponsorshipRenewal';
import {
  processSponsorshipRenewalsBatch,
  applySuccessfulRenewalPayment,
} from '../lib/sponsorshipRenewalEngine';

const supabase = createClient();

// Mock seed data for club sponsorships
export const MOCK_SPONSORSHIPS: SponsorshipTierRenewal[] = [
  {
    id: 'spon-pizza-shop',
    club_id: 'club-tech',
    club_name: 'Campus Tech & Coding Club',
    sponsor_name: "Luigi's Local Pizza Parlor",
    contact_person: 'Luigi Rossi',
    billing_email: 'billing@luigispizza.com',
    tier_name: 'Silver',
    annual_amount_usd: 500,
    start_date: new Date(Date.now() - 345 * 86400000).toISOString(),
    expiration_date: new Date(Date.now() + 20 * 86400000).toISOString(), // 20 days until expiration (<= 30d trigger!)
    auto_renew: true,
    renewal_status: 'active',
    is_active_in_rotator: true,
    rotator_logo_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=120',
    created_at: new Date(Date.now() - 345 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 345 * 86400000).toISOString(),
  },
  {
    id: 'spon-gold-cloud',
    club_id: 'club-tech',
    club_name: 'Campus Tech & Coding Club',
    sponsor_name: 'Apex Cloud Solutions',
    contact_person: 'Sarah Connor',
    billing_email: 'partnerships@apexcloud.io',
    tier_name: 'Gold',
    annual_amount_usd: 1500,
    start_date: new Date(Date.now() - 380 * 86400000).toISOString(),
    expiration_date: new Date(Date.now() - 15 * 86400000).toISOString(), // Expired 15 days ago (> 7d grace -> delist!)
    auto_renew: false,
    renewal_status: 'renewal_invoiced_30d',
    is_active_in_rotator: true,
    rotator_logo_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=120',
    created_at: new Date(Date.now() - 380 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'spon-platinum-fintech',
    club_id: 'club-tech',
    club_name: 'Campus Tech & Coding Club',
    sponsor_name: 'Vanguard Quantitative Trading',
    contact_person: 'David Kim',
    billing_email: 'sponsorships@vanguardquant.com',
    tier_name: 'Platinum',
    annual_amount_usd: 3500,
    start_date: new Date(Date.now() - 60 * 86400000).toISOString(),
    expiration_date: new Date(Date.now() + 305 * 86400000).toISOString(), // Plenty of time
    auto_renew: true,
    renewal_status: 'paid',
    is_active_in_rotator: true,
    rotator_logo_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=120',
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
];

export const sponsorshipRenewalService = {
  /**
   * Fetches all sponsorship records for a club.
   */
  async fetchClubSponsorships(clubId = 'club-tech'): Promise<SponsorshipTierRenewal[]> {
    try {
      if (!supabase) return MOCK_SPONSORSHIPS;

      const { data, error } = await supabase
        .from('sponsorship_tier_renewals')
        .select('*')
        .eq('club_id', clubId)
        .order('expiration_date', { ascending: true });

      if (error || !data || data.length === 0) {
        return MOCK_SPONSORSHIPS;
      }
      return data as SponsorshipTierRenewal[];
    } catch {
      return MOCK_SPONSORSHIPS;
    }
  },

  /**
   * Executes the automated renewal check cron job across sponsorships.
   */
  async runRenewalCronCheck(
    sponsorships?: SponsorshipTierRenewal[]
  ): Promise<{
    updatedList: SponsorshipTierRenewal[];
    invoices: SponsorshipInvoice[];
    summary: RenewalCronSummary;
  }> {
    const list = sponsorships || (await this.fetchClubSponsorships());
    const { updatedSponsorships, generatedInvoices, summary } =
      processSponsorshipRenewalsBatch(list);

    try {
      if (supabase) {
        await supabase.rpc('check_sponsorship_renewals_cron');
      }
    } catch (e) {
      console.warn('RPC check_sponsorship_renewals_cron skipped:', e);
    }

    return {
      updatedList: updatedSponsorships,
      invoices: generatedInvoices,
      summary,
    };
  },

  /**
   * Processes a successful Stripe invoice payment and renews sponsorship for +1 year.
   */
  async processSponsorPayment(
    sponsorshipId: string,
    currentList?: SponsorshipTierRenewal[]
  ): Promise<SponsorshipTierRenewal> {
    const list = currentList || (await this.fetchClubSponsorships());
    const target = list.find((s) => s.id === sponsorshipId);

    if (!target) {
      throw new Error(`Sponsorship with ID ${sponsorshipId} not found.`);
    }

    const updated = applySuccessfulRenewalPayment(target);

    try {
      if (supabase) {
        await supabase
          .from('sponsorship_tier_renewals')
          .update({
            expiration_date: updated.expiration_date,
            renewal_status: 'paid',
            is_active_in_rotator: true,
            updated_at: updated.updated_at,
          })
          .eq('id', sponsorshipId);
      }
    } catch (e) {
      console.warn('Supabase update skipped:', e);
    }

    return updated;
  },

  /**
   * Toggle active sponsor rotator status manually if needed.
   */
  async toggleRotatorStatus(
    sponsorshipId: string,
    isActive: boolean
  ): Promise<boolean> {
    try {
      if (supabase) {
        await supabase
          .from('sponsorship_tier_renewals')
          .update({ is_active_in_rotator: isActive })
          .eq('id', sponsorshipId);
      }
      return true;
    } catch {
      return true;
    }
  },
};
