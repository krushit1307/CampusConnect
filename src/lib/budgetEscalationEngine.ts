/**
 * Dynamic Event Budget Approval Escalation Engine
 * Issue #4287
 * Evaluates budget totals against strict tiered thresholds:
 * - Total < $200: Auto-Approve immediately with tag 'System_Auto_Approved'
 * - Total >= $200 and < $2000: Route to 'Student Union Treasurer' queue
 * - Total >= $2000: Route to 'University Admin' queue
 */

import {
  BudgetApprovalRequest,
  BudgetEscalationEvaluationResult,
  BudgetLineItem,
  BudgetSubmissionInput,
  BudgetAuditTrailEntry,
  BudgetApprovalStatus,
} from '../types/budgetApprovalEscalation';

export const AUTO_APPROVE_THRESHOLD_USD = 200.0;
export const UNIVERSITY_ADMIN_THRESHOLD_USD = 2000.0;

/**
 * Calculates sum total of all line items.
 */
export function calculateBudgetTotal(lineItems: BudgetLineItem[]): number {
  const sum = lineItems.reduce((acc, item) => acc + (item.total_cost || item.quantity * item.unit_cost), 0);
  return Math.round(sum * 100) / 100;
}

/**
 * Evaluates a proposed budget total against financial escalation rules.
 */
export function evaluateBudgetThresholdTier(
  totalAmount: number
): BudgetEscalationEvaluationResult {
  if (totalAmount < AUTO_APPROVE_THRESHOLD_USD) {
    return {
      tier_category: 'micro_tier',
      initial_status: 'system_auto_approved',
      assigned_queue: 'none',
      is_auto_approved: true,
      audit_tag: 'System_Auto_Approved',
      rationale: `Total budget ($${totalAmount.toFixed(
        2
      )}) is below the $200 auto-approval threshold. Auto-Approved instantly by policy rule.`,
      sla_hours_limit: 0,
    };
  }

  if (totalAmount < UNIVERSITY_ADMIN_THRESHOLD_USD) {
    return {
      tier_category: 'mid_tier',
      initial_status: 'pending_treasurer',
      assigned_queue: 'student_union_treasurer',
      is_auto_approved: false,
      audit_tag: 'Routed_Student_Union_Treasurer',
      rationale: `Total budget ($${totalAmount.toFixed(
        2
      )}) is between $200 and $2,000. Assigned to the Student Union Treasurer approval queue.`,
      sla_hours_limit: 48,
    };
  }

  return {
    tier_category: 'high_value_tier',
    initial_status: 'pending_admin',
    assigned_queue: 'university_admin',
    is_auto_approved: false,
    audit_tag: 'Routed_University_Admin',
    rationale: `High-value request ($${totalAmount.toFixed(
      2
    )}) exceeds $2,000. Escalated directly to University Administrative Governance queue.`,
    sla_hours_limit: 72,
  };
}

/**
 * Creates a new BudgetApprovalRequest object with tiered classification and audit trail.
 */
export function processBudgetSubmission(
  input: BudgetSubmissionInput
): { request: BudgetApprovalRequest; initialAudit: BudgetAuditTrailEntry } {
  const totalAmount = calculateBudgetTotal(input.line_items);
  const evalResult = evaluateBudgetThresholdTier(totalAmount);
  const now = new Date().toISOString();
  const requestId = `budget-${Date.now()}`;

  const request: BudgetApprovalRequest = {
    id: requestId,
    event_id: input.event_id,
    club_id: input.club_id,
    club_name: input.club_name,
    event_title: input.event_title,
    total_amount: totalAmount,
    tier_category: evalResult.tier_category,
    approval_status: evalResult.initial_status,
    assigned_queue: evalResult.assigned_queue,
    submitted_by: input.submitted_by_id || null,
    submitted_by_name: input.submitted_by_name,
    reviewed_by: evalResult.is_auto_approved ? 'system' : null,
    reviewed_by_name: evalResult.is_auto_approved ? 'System Escalation Engine' : null,
    line_items: input.line_items,
    is_auto_approved: evalResult.is_auto_approved,
    audit_tag: evalResult.audit_tag,
    submitted_at: now,
    reviewed_at: evalResult.is_auto_approved ? now : null,
    created_at: now,
    updated_at: now,
  };

  const initialAudit: BudgetAuditTrailEntry = {
    id: `audit-${Date.now()}-init`,
    request_id: requestId,
    action: evalResult.is_auto_approved ? 'SYSTEM_AUTO_APPROVED' : 'SUBMITTED_FOR_REVIEW',
    actor_name: evalResult.is_auto_approved ? 'System Escalation Engine' : input.submitted_by_name,
    previous_status: 'draft',
    new_status: evalResult.initial_status,
    audit_tag: evalResult.audit_tag,
    notes: evalResult.rationale,
    created_at: now,
  };

  return { request, initialAudit };
}

/**
 * Applies approval or rejection decision from authorized reviewer.
 */
export function applyReviewerDecision(
  request: BudgetApprovalRequest,
  decision: 'approve' | 'reject' | 'escalate_to_admin',
  reviewerName: string,
  reviewerId: string,
  notes?: string
): { updatedRequest: BudgetApprovalRequest; auditEntry: BudgetAuditTrailEntry } {
  const now = new Date().toISOString();
  let newStatus: BudgetApprovalStatus = 'approved';
  let auditAction = 'APPROVED';
  let auditTag = 'Manual_Approved';

  if (decision === 'reject') {
    newStatus = 'rejected';
    auditAction = 'REJECTED';
    auditTag = 'Manual_Rejected';
  } else if (decision === 'escalate_to_admin') {
    newStatus = 'pending_admin';
    auditAction = 'ESCALATED_TO_ADMIN';
    auditTag = 'Escalated_By_Treasurer';
  }

  const updatedRequest: BudgetApprovalRequest = {
    ...request,
    approval_status: newStatus,
    reviewed_by: reviewerId,
    reviewed_by_name: reviewerName,
    review_notes: notes || null,
    rejection_reason: decision === 'reject' ? notes || 'Budget allocation rejected' : null,
    reviewed_at: now,
    updated_at: now,
  };

  const auditEntry: BudgetAuditTrailEntry = {
    id: `audit-${Date.now()}-decision`,
    request_id: request.id,
    action: auditAction,
    actor_name: reviewerName,
    previous_status: request.approval_status,
    new_status: newStatus,
    audit_tag: auditTag,
    notes: notes || `Request ${decision} by ${reviewerName}`,
    created_at: now,
  };

  return { updatedRequest, auditEntry };
}
