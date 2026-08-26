/**
 * Sponsorship Tier Renewal Invoicing & Rotator Sync Types
 * Issue #4141
 */

export type RenewalStatus =
  | 'active'
  | 'renewal_invoiced_30d'
  | 'paid'
  | 'grace_period'
  | 'expired_unpaid'
  | 'rotator_delisted';

export type SponsorshipTierLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Title';

export interface SponsorshipTierRenewal {
  id: string;
  club_id: string;
  club_name?: string;
  sponsor_name: string;
  contact_person?: string;
  billing_email: string;
  tier_name: SponsorshipTierLevel;
  annual_amount_usd: number;
  start_date: string;
  expiration_date: string;
  auto_renew: boolean;
  renewal_status: RenewalStatus;
  stripe_customer_id?: string;
  stripe_invoice_id?: string;
  invoice_pdf_url?: string;
  is_active_in_rotator: boolean;
  rotator_logo_url?: string;
  last_renewal_email_sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SponsorshipInvoice {
  id: string;
  sponsorship_id: string;
  club_id: string;
  invoice_number: string;
  amount_usd: number;
  billing_period_start: string;
  billing_period_end: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  stripe_invoice_url?: string;
  sent_to_email: string;
  paid_at?: string | null;
  created_at: string;
}

export interface RenewalEmailNotificationPayload {
  to_email: string;
  sponsor_name: string;
  club_name: string;
  tier_name: SponsorshipTierLevel;
  amount_usd: number;
  expiration_date: string;
  invoice_url: string;
  days_until_expiration: number;
}

export interface RenewalCronSummary {
  executed_at: string;
  total_checked: number;
  invoices_generated: number;
  emails_dispatched: number;
  rotators_delisted: number;
  renewed_records: string[];
  delisted_records: string[];
}

export interface RenewalActionSimulation {
  sponsorship: SponsorshipTierRenewal;
  days_remaining: number;
  action_needed: 'none' | 'send_30d_invoice' | 'enter_grace_period' | 'delist_from_rotator';
  projected_status: RenewalStatus;
  invoice_preview?: Partial<SponsorshipInvoice>;
}
