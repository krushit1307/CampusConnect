/**
 * Budget Approval Escalation Service
 * Handles database operations, auto-approvals, queue filtering, and audit history.
 * Issue #4287
 */

import { createClient } from '../lib/supabase/client';
import {
  BudgetApprovalRequest,
  BudgetSubmissionInput,
  BudgetAuditTrailEntry,
  BudgetAssignedQueue,
  BudgetApprovalStatus,
} from '../types/budgetApprovalEscalation';
import {
  processBudgetSubmission,
  applyReviewerDecision,
} from '../lib/budgetEscalationEngine';

const supabase = createClient();

// Seed mock data for development and tests
export const MOCK_BUDGET_REQUESTS: BudgetApprovalRequest[] = [
  {
    id: 'req-pizza-50',
    event_id: 'evt-hack-study',
    club_id: 'club-tech',
    club_name: 'Campus Tech Club',
    event_title: 'Weekly Late-Night Study Jam',
    total_amount: 50.0,
    tier_category: 'micro_tier',
    approval_status: 'system_auto_approved',
    assigned_queue: 'none',
    submitted_by: 'usr-1',
    submitted_by_name: 'Alex Rivera (Treasurer)',
    reviewed_by: 'system',
    reviewed_by_name: 'System Escalation Engine',
    is_auto_approved: true,
    audit_tag: 'System_Auto_Approved',
    line_items: [
      {
        id: 'li-1',
        category: 'food_catering',
        description: '2 Large Pizzas & Soda',
        quantity: 2,
        unit_cost: 25.0,
        total_cost: 50.0,
      },
    ],
    submitted_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    reviewed_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'req-speakers-650',
    event_id: 'evt-career-panel',
    club_id: 'club-biz',
    club_name: 'Business Leaders Association',
    event_title: 'Alumni Executive Panel & Reception',
    total_amount: 650.0,
    tier_category: 'mid_tier',
    approval_status: 'pending_treasurer',
    assigned_queue: 'student_union_treasurer',
    submitted_by: 'usr-2',
    submitted_by_name: 'Jordan Lee (President)',
    is_auto_approved: false,
    audit_tag: 'Routed_Student_Union_Treasurer',
    line_items: [
      {
        id: 'li-2',
        category: 'food_catering',
        description: 'Catered Sandwiches and Fruit Platters',
        quantity: 1,
        unit_cost: 450.0,
        total_cost: 450.0,
      },
      {
        id: 'li-3',
        category: 'marketing',
        description: 'Event Posters & Welcome Banners',
        quantity: 1,
        unit_cost: 200.0,
        total_cost: 200.0,
      },
    ],
    submitted_at: new Date(Date.now() - 14 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 14 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 14 * 3600000).toISOString(),
  },
  {
    id: 'req-gala-8500',
    event_id: 'evt-spring-gala',
    club_id: 'club-cultural',
    club_name: 'International Students Council',
    event_title: 'Annual Spring Cultural Gala & Banquet',
    total_amount: 8500.0,
    tier_category: 'high_value_tier',
    approval_status: 'pending_admin',
    assigned_queue: 'university_admin',
    submitted_by: 'usr-3',
    submitted_by_name: 'Priya Patel (Chair)',
    is_auto_approved: false,
    audit_tag: 'Routed_University_Admin',
    line_items: [
      {
        id: 'li-4',
        category: 'venue',
        description: 'Main Campus Auditorium & Stage Rental',
        quantity: 1,
        unit_cost: 3500.0,
        total_cost: 3500.0,
      },
      {
        id: 'li-5',
        category: 'food_catering',
        description: 'Multi-Course Dinner for 300 Guests',
        quantity: 1,
        unit_cost: 5000.0,
        total_cost: 5000.0,
      },
    ],
    submitted_at: new Date(Date.now() - 48 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 48 * 3600000).toISOString(),
  },
];

export const budgetApprovalEscalationService = {
  /**
   * Submits a draft budget and evaluates financial tiered escalation.
   */
  async submitBudget(input: BudgetSubmissionInput): Promise<{
    request: BudgetApprovalRequest;
    auditEntry: BudgetAuditTrailEntry;
  }> {
    const { request, initialAudit } = processBudgetSubmission(input);

    try {
      if (supabase) {
        await supabase.from('event_budget_approval_requests').insert({
          id: request.id,
          event_id: request.event_id,
          club_id: request.club_id,
          club_name: request.club_name,
          event_title: request.event_title,
          total_amount: request.total_amount,
          tier_category: request.tier_category,
          approval_status: request.approval_status,
          assigned_queue: request.assigned_queue,
          submitted_by_name: request.submitted_by_name,
          is_auto_approved: request.is_auto_approved,
          audit_tag: request.audit_tag,
          line_items: request.line_items,
          reviewed_at: request.reviewed_at,
        });

        await supabase.from('budget_approval_audit_trail').insert({
          request_id: request.id,
          action: initialAudit.action,
          actor_name: initialAudit.actor_name,
          new_status: initialAudit.new_status,
          audit_tag: initialAudit.audit_tag,
          notes: initialAudit.notes,
        });
      }
    } catch (e) {
      console.warn('Supabase insert fallback:', e);
    }

    return { request, auditEntry: initialAudit };
  },

  /**
   * Fetches all requests assigned to a specific role queue.
   */
  async fetchRequestsByQueue(
    queue: BudgetAssignedQueue | 'all' = 'all'
  ): Promise<BudgetApprovalRequest[]> {
    try {
      if (!supabase) {
        if (queue === 'all') return MOCK_BUDGET_REQUESTS;
        return MOCK_BUDGET_REQUESTS.filter((r) => r.assigned_queue === queue);
      }

      let query = supabase
        .from('event_budget_approval_requests')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (queue !== 'all') {
        query = query.eq('assigned_queue', queue);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        if (queue === 'all') return MOCK_BUDGET_REQUESTS;
        return MOCK_BUDGET_REQUESTS.filter((r) => r.assigned_queue === queue);
      }

      return data as BudgetApprovalRequest[];
    } catch {
      return MOCK_BUDGET_REQUESTS;
    }
  },

  /**
   * Performs approval, rejection, or admin escalation on a request.
   */
  async submitReviewDecision(
    request: BudgetApprovalRequest,
    decision: 'approve' | 'reject' | 'escalate_to_admin',
    reviewerName: string,
    reviewerId: string,
    notes?: string
  ): Promise<{
    updatedRequest: BudgetApprovalRequest;
    auditEntry: BudgetAuditTrailEntry;
  }> {
    const { updatedRequest, auditEntry } = applyReviewerDecision(
      request,
      decision,
      reviewerName,
      reviewerId,
      notes
    );

    try {
      if (supabase) {
        await supabase
          .from('event_budget_approval_requests')
          .update({
            approval_status: updatedRequest.approval_status,
            reviewed_by: reviewerId,
            reviewed_by_name: reviewerName,
            review_notes: updatedRequest.review_notes,
            rejection_reason: updatedRequest.rejection_reason,
            reviewed_at: updatedRequest.reviewed_at,
            updated_at: updatedRequest.updated_at,
          })
          .eq('id', request.id);

        await supabase.from('budget_approval_audit_trail').insert({
          request_id: request.id,
          action: auditEntry.action,
          actor_name: reviewerName,
          previous_status: auditEntry.previous_status,
          new_status: auditEntry.new_status,
          audit_tag: auditEntry.audit_tag,
          notes: auditEntry.notes,
        });
      }
    } catch (e) {
      console.warn('Supabase review decision update fallback:', e);
    }

    return { updatedRequest, auditEntry };
  },
};
