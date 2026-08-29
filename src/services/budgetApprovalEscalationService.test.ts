import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  budgetApprovalEscalationService,
  MOCK_BUDGET_REQUESTS,
} from './budgetApprovalEscalationService';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('../lib/supabase/client', () => {
  return {
    createClient: vi.fn(() => ({
      from: mockFrom,
    })),
  };
});

describe('Budget Approval Escalation Service (#4287)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches budget approval requests by queue filter with fallback data', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: MOCK_BUDGET_REQUESTS,
        error: null,
      }),
      eq: vi.fn().mockResolvedValue({
        data: MOCK_BUDGET_REQUESTS.filter((r) => r.assigned_queue === 'student_union_treasurer'),
        error: null,
      }),
    });

    const all = await budgetApprovalEscalationService.fetchRequestsByQueue('all');
    expect(all.length).toBeGreaterThan(0);

    const treasurerQueue =
      await budgetApprovalEscalationService.fetchRequestsByQueue('student_union_treasurer');
    expect(treasurerQueue.length).toBeGreaterThan(0);
  });

  it('submits a new micro-budget request and auto-approves it', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const { request, auditEntry } = await budgetApprovalEscalationService.submitBudget({
      event_id: 'evt-pizza',
      club_id: 'club-tech',
      club_name: 'Campus Tech',
      event_title: 'Hackathon Snacks',
      submitted_by_name: 'Alex Rivera',
      line_items: [
        {
          id: 'li-1',
          category: 'food_catering',
          description: 'Pizza',
          quantity: 2,
          unit_cost: 25,
          total_cost: 50,
        },
      ],
    });

    expect(request.is_auto_approved).toBe(true);
    expect(request.approval_status).toBe('system_auto_approved');
    expect(request.audit_tag).toBe('System_Auto_Approved');
    expect(auditEntry.audit_tag).toBe('System_Auto_Approved');
  });

  it('submits reviewer decision for approval or rejection', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const sample = MOCK_BUDGET_REQUESTS[1]; // pending_treasurer
    const { updatedRequest, auditEntry } =
      await budgetApprovalEscalationService.submitReviewDecision(
        sample,
        'approve',
        'Treasurer Jordan',
        'usr-t1',
        'Verified against club allocated budget.'
      );

    expect(updatedRequest.approval_status).toBe('approved');
    expect(auditEntry.action).toBe('APPROVED');
  });
});
