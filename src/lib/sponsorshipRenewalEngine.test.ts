import { describe, it, expect } from 'vitest';
import {
  calculateDaysToExpiration,
  evaluateRenewalAction,
  buildRenewalEmailPayload,
  generateRenewalEmailContent,
  processSponsorshipRenewalsBatch,
  applySuccessfulRenewalPayment,
} from './sponsorshipRenewalEngine';
import { SponsorshipTierRenewal } from '../types/sponsorshipRenewal';

describe('Sponsorship Tier Renewal Engine (#4141)', () => {
  const baseSponsorship: SponsorshipTierRenewal = {
    id: 'spon-pizza-1',
    club_id: 'club-tech',
    club_name: 'Campus Tech Club',
    sponsor_name: "Luigi's Pizza",
    billing_email: 'billing@luigispizza.com',
    tier_name: 'Silver',
    annual_amount_usd: 500,
    start_date: '2025-08-27T00:00:00Z',
    expiration_date: '2026-09-15T00:00:00Z', // 20 days away
    auto_renew: true,
    renewal_status: 'active',
    is_active_in_rotator: true,
    created_at: '2025-08-27T00:00:00Z',
    updated_at: '2025-08-27T00:00:00Z',
  };

  it('calculates remaining days to expiration correctly', () => {
    const refDate = new Date('2026-08-26T00:00:00Z');
    const days = calculateDaysToExpiration('2026-09-15T00:00:00Z', refDate);
    expect(days).toBe(20);
  });

  it('triggers send_30d_invoice action when expiration is <= 30 days away', () => {
    const refDate = new Date('2026-08-26T00:00:00Z');
    const sim = evaluateRenewalAction(baseSponsorship, refDate);

    expect(sim.action_needed).toBe('send_30d_invoice');
    expect(sim.projected_status).toBe('renewal_invoiced_30d');
    expect(sim.invoicePreview).toBeDefined();
    expect(sim.invoicePreview?.amount_usd).toBe(500);
  });

  it('triggers delist_from_rotator when unpaid past expiration and grace period', () => {
    const expiredSponsorship: SponsorshipTierRenewal = {
      ...baseSponsorship,
      expiration_date: '2026-08-01T00:00:00Z', // 25 days expired
      renewal_status: 'renewal_invoiced_30d',
    };
    const refDate = new Date('2026-08-26T00:00:00Z');
    const sim = evaluateRenewalAction(expiredSponsorship, refDate, 7);

    expect(sim.action_needed).toBe('delist_from_rotator');
    expect(sim.projected_status).toBe('rotator_delisted');
  });

  it('builds exact renewal email notification matching issue spec', () => {
    const payload = buildRenewalEmailPayload(baseSponsorship, 'Campus Tech Club');
    const { subject, body } = generateRenewalEmailContent(payload);

    expect(subject).toContain('Silver Sponsorship');
    expect(body).toContain('is expiring');
    expect(body).toContain('Click here to pay and maintain your active logo placement');
    expect(body).toContain('$500/year');
  });

  it('processes batch renewals and generates invoices, emails, and delistings', () => {
    const refDate = new Date('2026-08-26T00:00:00Z');
    const list: SponsorshipTierRenewal[] = [
      { ...baseSponsorship, id: 's1', expiration_date: '2026-09-15T00:00:00Z' }, // 20d -> invoice
      { ...baseSponsorship, id: 's2', expiration_date: '2026-08-01T00:00:00Z' }, // expired -> delist
      { ...baseSponsorship, id: 's3', expiration_date: '2027-01-01T00:00:00Z' }, // far -> none
    ];

    const result = processSponsorshipRenewalsBatch(list, refDate);

    expect(result.summary.invoices_generated).toBe(1);
    expect(result.summary.emails_dispatched).toBe(1);
    expect(result.summary.rotators_delisted).toBe(1);
    expect(result.updatedSponsorships.find((s) => s.id === 's2')?.is_active_in_rotator).toBe(
      false
    );
  });

  it('extends expiration date by +365 days upon successful renewal payment', () => {
    const paymentDate = new Date('2026-08-26T00:00:00Z');
    const renewed = applySuccessfulRenewalPayment(baseSponsorship, paymentDate);

    expect(renewed.renewal_status).toBe('paid');
    expect(renewed.is_active_in_rotator).toBe(true);
    expect(new Date(renewed.expiration_date).getFullYear()).toBe(2027);
  });
});
