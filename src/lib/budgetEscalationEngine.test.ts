import { describe, it, expect } from 'vitest';
import {
  calculateBudgetTotal,
  evaluateBudgetThresholdTier,
  processBudgetSubmission,
  applyReviewerDecision,
  AUTO_APPROVE_THRESHOLD_USD,
  UNIVERSITY_ADMIN_THRESHOLD_USD,
} from './budgetEscalationEngine';
import {
  BudgetLineItem,
  BudgetSubmissionInput,
} from '../types/budgetApprovalEscalation';

describe('Event Budget Approval Escalation Engine (#4287)', () => {
  const sampleLineItems: BudgetLineItem[] = [
    {
      id: 'li-1',
      category: 'food_catering',
      description: 'Pizzas and snacks',
      quantity: 3,
      unit_cost: 30,
      total_cost: 90,
    },
    {
      id: 'li-2',
      category: 'marketing',
      description: 'Stickers & posters',
      quantity: 1,
      unit_cost: 40,
      total_cost: 40,
    },
  ];

  it('calculates total budget amount correctly from line items', () => {
    const total = calculateBudgetTotal(sampleLineItems);
    expect(total).toBe(130.0);
  });

  it('auto-approves budgets under $200 with tag System_Auto_Approved', () => {
    const result = evaluateBudgetThresholdTier(130.0);

    expect(result.is_auto_approved).toBe(true);
    expect(result.initial_status).toBe('system_auto_approved');
    expect(result.assigned_queue).toBe('none');
    expect(result.audit_tag).toBe('System_Auto_Approved');
    expect(result.tier_category).toBe('micro_tier');
  });

  it('routes budgets >= $200 and < $2000 to Student Union Treasurer queue', () => {
    const result = evaluateBudgetThresholdTier(850.0);

    expect(result.is_auto_approved).toBe(false);
    expect(result.initial_status).toBe('pending_treasurer');
    expect(result.assigned_queue).toBe('student_union_treasurer');
    expect(result.audit_tag).toBe('Routed_Student_Union_Treasurer');
    expect(result.tier_category).toBe('mid_tier');
  });

  it('routes budgets >= $2000 to University Admin approval queue', () => {
    const result = evaluateBudgetThresholdTier(5000.0);

    expect(result.is_auto_approved).toBe(false);
    expect(result.initial_status).toBe('pending_admin');
    expect(result.assigned_queue).toBe('university_admin');
    expect(result.audit_tag).toBe('Routed_University_Admin');
    expect(result.tier_category).toBe('high_value_tier');
  });

  it('processes budget submission and initializes audit trail record', () => {
    const input: BudgetSubmissionInput = {
      event_id: 'evt-study',
      club_id: 'club-tech',
      club_name: 'Campus Tech',
      event_title: 'Study Night Pizza',
      submitted_by_name: 'Alex Rivera',
      line_items: [
        {
          id: 'li-p',
          category: 'food_catering',
          description: 'Pizza',
          quantity: 2,
          unit_cost: 25,
          total_cost: 50,
        },
      ],
    };

    const { request, initialAudit } = processBudgetSubmission(input);

    expect(request.total_amount).toBe(50);
    expect(request.is_auto_approved).toBe(true);
    expect(request.approval_status).toBe('system_auto_approved');
    expect(initialAudit.audit_tag).toBe('System_Auto_Approved');
  });

  it('applies reviewer approval, rejection, and admin escalation decisions', () => {
    const input: BudgetSubmissionInput = {
      event_id: 'evt-equip',
      club_id: 'club-tech',
      club_name: 'Campus Tech',
      event_title: 'Server Equipment',
      submitted_by_name: 'Alex Rivera',
      line_items: [
        {
          id: 'li-s',
          category: 'equipment',
          description: 'GPU Cluster Mini',
          quantity: 1,
          unit_cost: 800,
          total_cost: 800,
        },
      ],
    };

    const { request } = processBudgetSubmission(input);
    expect(request.approval_status).toBe('pending_treasurer');

    // Approve
    const { updatedRequest: approved, auditEntry: auditApprove } =
      applyReviewerDecision(request, 'approve', 'Treasurer John', 'usr-t1');
    expect(approved.approval_status).toBe('approved');
    expect(auditApprove.action).toBe('APPROVED');

    // Reject
    const { updatedRequest: rejected, auditEntry: auditReject } =
      applyReviewerDecision(request, 'reject', 'Treasurer John', 'usr-t1', 'Cap exceeded');
    expect(rejected.approval_status).toBe('rejected');
    expect(rejected.rejection_reason).toBe('Cap exceeded');
    expect(auditReject.action).toBe('REJECTED');
  });
});
