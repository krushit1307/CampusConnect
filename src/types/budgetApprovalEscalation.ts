/**
 * Event Budget Approval Escalation Engine Types
 * Issue #4287
 */

export type BudgetTierCategory = 'micro_tier' | 'mid_tier' | 'high_value_tier';

export type BudgetApprovalStatus =
  | 'system_auto_approved'
  | 'pending_treasurer'
  | 'pending_admin'
  | 'approved'
  | 'rejected'
  | 'escalated';

export type BudgetAssignedQueue =
  | 'none'
  | 'student_union_treasurer'
  | 'university_admin';

export interface BudgetLineItem {
  id: string;
  category: 'food_catering' | 'equipment' | 'speaker_fee' | 'venue' | 'marketing' | 'other';
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

export interface BudgetApprovalRequest {
  id: string;
  event_id: string;
  club_id: string;
  club_name: string;
  event_title: string;
  total_amount: number;
  tier_category: BudgetTierCategory;
  approval_status: BudgetApprovalStatus;
  assigned_queue: BudgetAssignedQueue;
  submitted_by?: string | null;
  submitted_by_name: string;
  reviewed_by?: string | null;
  reviewed_by_name?: string | null;
  review_notes?: string | null;
  rejection_reason?: string | null;
  line_items: BudgetLineItem[];
  is_auto_approved: boolean;
  audit_tag: string;
  submitted_at: string;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetAuditTrailEntry {
  id: string;
  request_id: string;
  action: string;
  actor_name: string;
  previous_status?: string | null;
  new_status: string;
  audit_tag?: string | null;
  notes: string;
  created_at: string;
}

export interface BudgetEscalationEvaluationResult {
  tier_category: BudgetTierCategory;
  initial_status: BudgetApprovalStatus;
  assigned_queue: BudgetAssignedQueue;
  is_auto_approved: boolean;
  audit_tag: string;
  rationale: string;
  sla_hours_limit: number;
}

export interface BudgetSubmissionInput {
  event_id: string;
  club_id: string;
  club_name: string;
  event_title: string;
  submitted_by_name: string;
  submitted_by_id?: string;
  line_items: BudgetLineItem[];
}
