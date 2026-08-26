import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sponsorshipRenewalService,
  MOCK_SPONSORSHIPS,
} from './sponsorshipRenewalService';

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('../lib/supabase/client', () => {
  return {
    createClient: vi.fn(() => ({
      from: mockFrom,
      rpc: mockRpc,
    })),
  };
});

describe('Sponsorship Renewal Service (#4141)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches club sponsorships with fallback data', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: MOCK_SPONSORSHIPS,
        error: null,
      }),
    });

    const list = await sponsorshipRenewalService.fetchClubSponsorships('club-tech');
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty('sponsor_name');
    expect(list[0]).toHaveProperty('tier_name');
  });

  it('executes renewal cron check and processes 30d invoices and delistings', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: MOCK_SPONSORSHIPS,
        error: null,
      }),
    });
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });

    const res = await sponsorshipRenewalService.runRenewalCronCheck(MOCK_SPONSORSHIPS);
    expect(res.updatedList.length).toBe(MOCK_SPONSORSHIPS.length);
    expect(res.summary.total_checked).toBe(3);
    expect(res.summary.invoices_generated).toBeGreaterThanOrEqual(1);
  });

  it('processes sponsor payment and renews term for +365 days', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const renewed = await sponsorshipRenewalService.processSponsorPayment(
      'spon-pizza-shop',
      MOCK_SPONSORSHIPS
    );

    expect(renewed.renewal_status).toBe('paid');
    expect(renewed.is_active_in_rotator).toBe(true);
  });
});
