/**
 * Sponsorship Tier Renewal Invoicing & Rotator Synchronization Engine
 * Issue #4141
 * Manages automated 30-day invoice triggering, Stripe billing simulations,
 * renewal email templating, and logo rotator unpublishing on expiration.
 */

import {
  SponsorshipTierRenewal,
  SponsorshipInvoice,
  RenewalStatus,
  RenewalEmailNotificationPayload,
  RenewalCronSummary,
  RenewalActionSimulation,
} from '../types/sponsorshipRenewal';

/**
 * Calculates remaining days until sponsorship expiration.
 */
export function calculateDaysToExpiration(
  expirationDateIso: string,
  referenceDate: Date = new Date()
): number {
  const expTime = new Date(expirationDateIso).getTime();
  const refTime = referenceDate.getTime();
  const diffMillis = expTime - refTime;
  return Math.ceil(diffMillis / (1000 * 60 * 60 * 24));
}

/**
 * Determines the required lifecycle transition for a sponsorship record.
 */
export function evaluateRenewalAction(
  sponsorship: SponsorshipTierRenewal,
  currentDate: Date = new Date(),
  gracePeriodDays = 7
): RenewalActionSimulation {
  const daysRemaining = calculateDaysToExpiration(
    sponsorship.expiration_date,
    currentDate
  );

  let action: 'none' | 'send_30d_invoice' | 'enter_grace_period' | 'delist_from_rotator' =
    'none';
  let projectedStatus: RenewalStatus = sponsorship.renewal_status;

  if (sponsorship.renewal_status === 'paid') {
    return {
      sponsorship,
      days_remaining: daysRemaining,
      action_needed: 'none',
      projected_status: 'paid',
    };
  }

  // If expiring in <= 30 days and currently active (not yet invoiced)
  if (daysRemaining <= 30 && daysRemaining > 0) {
    if (sponsorship.renewal_status === 'active') {
      action = 'send_30d_invoice';
      projectedStatus = 'renewal_invoiced_30d';
    }
  } else if (daysRemaining <= 0 && daysRemaining > -gracePeriodDays) {
    // Passed expiration date, within grace period
    if (sponsorship.renewal_status !== 'paid') {
      action = 'enter_grace_period';
      projectedStatus = 'grace_period';
    }
  } else if (daysRemaining <= -gracePeriodDays) {
    // Unpaid past grace period: Delist from Active Sponsor Rotator
    if (sponsorship.is_active_in_rotator || sponsorship.renewal_status !== 'rotator_delisted') {
      action = 'delist_from_rotator';
      projectedStatus = 'rotator_delisted';
    }
  }

  const invoicePreview: Partial<SponsorshipInvoice> =
    action === 'send_30d_invoice' || sponsorship.renewal_status === 'renewal_invoiced_30d'
      ? {
          invoice_number: `INV-${sponsorship.tier_name.toUpperCase()}-${sponsorship.id.slice(0, 6)}-${new Date().getFullYear()}`,
          amount_usd: sponsorship.annual_amount_usd,
          sent_to_email: sponsorship.billing_email,
          status: 'open',
          stripe_invoice_url: `https://checkout.stripe.com/pay/cs_live_${sponsorship.id.slice(0, 12)}`,
        }
      : undefined;

  return {
    sponsorship,
    days_remaining: daysRemaining,
    action_needed: action,
    projected_status: projectedStatus,
    invoicePreview,
  };
}

/**
 * Builds email notification message for 30-day renewal invoicing.
 * Spec: "Your Gold Sponsorship with the Tech Club is expiring. Click here to pay and maintain your logo placement."
 */
export function buildRenewalEmailPayload(
  sponsorship: SponsorshipTierRenewal,
  clubName = 'Campus Student Club',
  invoiceUrl?: string
): RenewalEmailNotificationPayload {
  const days = calculateDaysToExpiration(sponsorship.expiration_date);
  const payUrl =
    invoiceUrl ||
    `https://campusconnect.edu/sponsor/renew/${sponsorship.id}?token=tok_${sponsorship.id.slice(0, 8)}`;

  return {
    to_email: sponsorship.billing_email,
    sponsor_name: sponsorship.sponsor_name,
    club_name: clubName,
    tier_name: sponsorship.tier_name,
    amount_usd: sponsorship.annual_amount_usd,
    expiration_date: sponsorship.expiration_date,
    invoice_url: payUrl,
    days_until_expiration: Math.max(0, days),
  };
}

/**
 * Generates email HTML / body text matching the exact issue specification.
 */
export function generateRenewalEmailContent(
  payload: RenewalEmailNotificationPayload
): { subject: string; body: string } {
  const subject = `Your ${payload.tier_name} Sponsorship with ${payload.club_name} is expiring soon`;
  const body = `Dear ${payload.sponsor_name},\n\nYour ${payload.tier_name} Sponsorship ($${payload.amount_usd}/year) with ${payload.club_name} is expiring in ${payload.days_until_expiration} days (on ${new Date(payload.expiration_date).toLocaleDateString()}).\n\nClick here to pay and maintain your active logo placement on our sponsor banner: ${payload.invoice_url}\n\nIf unpaid by the expiration date, sponsor banner placements will be automatically unlisted.\n\nThank you for supporting student organizations at CampusConnect!`;

  return { subject, body };
}

/**
 * Executes a batch renewal check across a collection of sponsorships.
 */
export function processSponsorshipRenewalsBatch(
  sponsorships: SponsorshipTierRenewal[],
  referenceDate: Date = new Date()
): {
  updatedSponsorships: SponsorshipTierRenewal[];
  generatedInvoices: SponsorshipInvoice[];
  dispatchedEmails: RenewalEmailNotificationPayload[];
  summary: RenewalCronSummary;
} {
  const updatedSponsorships: SponsorshipTierRenewal[] = [];
  const generatedInvoices: SponsorshipInvoice[] = [];
  const dispatchedEmails: RenewalEmailNotificationPayload[] = [];
  const renewedRecords: string[] = [];
  const delistedRecords: string[] = [];

  for (const item of sponsorships) {
    const sim = evaluateRenewalAction(item, referenceDate);
    const updated = { ...item };

    if (sim.action_needed === 'send_30d_invoice') {
      updated.renewal_status = 'renewal_invoiced_30d';
      updated.last_renewal_email_sent_at = referenceDate.toISOString();
      updated.updated_at = referenceDate.toISOString();

      const invoice: SponsorshipInvoice = {
        id: `inv-${Date.now()}-${item.id.slice(0, 4)}`,
        sponsorship_id: item.id,
        club_id: item.club_id,
        invoice_number: `INV-${item.tier_name.toUpperCase()}-${Date.now().toString().slice(-6)}`,
        amount_usd: item.annual_amount_usd,
        billing_period_start: item.expiration_date,
        billing_period_end: new Date(
          new Date(item.expiration_date).getTime() + 365 * 86400000
        ).toISOString(),
        status: 'open',
        sent_to_email: item.billing_email,
        stripe_invoice_url: `https://checkout.stripe.com/pay/inv_${item.id.slice(0, 8)}`,
        created_at: referenceDate.toISOString(),
      };

      generatedInvoices.push(invoice);
      dispatchedEmails.push(
        buildRenewalEmailPayload(updated, item.club_name, invoice.stripe_invoice_url)
      );
      renewedRecords.push(item.id);
    } else if (sim.action_needed === 'delist_from_rotator') {
      updated.renewal_status = 'rotator_delisted';
      updated.is_active_in_rotator = false;
      updated.updated_at = referenceDate.toISOString();
      delistedRecords.push(item.id);
    } else if (sim.action_needed === 'enter_grace_period') {
      updated.renewal_status = 'grace_period';
      updated.updated_at = referenceDate.toISOString();
    }

    updatedSponsorships.push(updated);
  }

  const summary: RenewalCronSummary = {
    executed_at: referenceDate.toISOString(),
    total_checked: sponsorships.length,
    invoices_generated: generatedInvoices.length,
    emails_dispatched: dispatchedEmails.length,
    rotators_delisted: delistedRecords.length,
    renewed_records: renewedRecords,
    delisted_records: delistedRecords,
  };

  return {
    updatedSponsorships,
    generatedInvoices,
    dispatchedEmails,
    summary,
  };
}

/**
 * Handles invoice settlement and advances the sponsorship expiration by +1 year (365 days).
 */
export function applySuccessfulRenewalPayment(
  sponsorship: SponsorshipTierRenewal,
  paymentTimestamp: Date = new Date()
): SponsorshipTierRenewal {
  const currentExp = new Date(sponsorship.expiration_date);
  // Extend by 365 days from old expiration if not severely lapsed, or from today
  const baseTime = currentExp > paymentTimestamp ? currentExp : paymentTimestamp;
  const newExpiration = new Date(baseTime.getTime() + 365 * 86400000);

  return {
    ...sponsorship,
    expiration_date: newExpiration.toISOString(),
    renewal_status: 'paid',
    is_active_in_rotator: true,
    updated_at: paymentTimestamp.toISOString(),
  };
}
