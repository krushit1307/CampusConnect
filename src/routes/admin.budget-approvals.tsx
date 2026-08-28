/**
 * Administrative & Treasurer Budget Approval Center Page
 * Route: /admin/budget-approvals
 * Issue #4287
 */

import React, { useState, useEffect } from 'react';
import {
  BudgetApprovalRequest,
  BudgetSubmissionInput,
  BudgetAuditTrailEntry,
} from '../types/budgetApprovalEscalation';
import { budgetApprovalEscalationService } from '../services/budgetApprovalEscalationService';
import { BudgetApprovalQueue } from '../components/budget/BudgetApprovalQueue';
import { BudgetSubmissionEscalationModal } from '../components/budget/BudgetSubmissionEscalationModal';
import { BudgetAuditTrailTimeline } from '../components/budget/BudgetAuditTrailTimeline';
import {
  DollarSign,
  ShieldCheck,
  PlusCircle,
  RefreshCw,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function AdminBudgetApprovalsPage() {
  const [requests, setRequests] = useState<BudgetApprovalRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<BudgetAuditTrailEntry[]>([
    {
      id: 'audit-demo-1',
      request_id: 'req-pizza-50',
      action: 'SYSTEM_AUTO_APPROVED',
      actor_name: 'System Escalation Engine',
      new_status: 'system_auto_approved',
      audit_tag: 'System_Auto_Approved',
      notes:
        'Total amount ($50.00) under $200 threshold: Automatically approved with audit tag System_Auto_Approved.',
      created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
  ]);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const data = await budgetApprovalEscalationService.fetchRequestsByQueue('all');
      setRequests(data);
    } catch (err) {
      console.error('Failed to load budget requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (request: BudgetApprovalRequest, notes?: string) => {
    const { updatedRequest, auditEntry } =
      await budgetApprovalEscalationService.submitReviewDecision(
        request,
        'approve',
        'Student Union Treasurer',
        'usr-current',
        notes
      );

    setRequests((prev) =>
      prev.map((r) => (r.id === request.id ? updatedRequest : r))
    );
    setAuditLogs((prev) => [auditEntry, ...prev]);
  };

  const handleReject = async (request: BudgetApprovalRequest, reason: string) => {
    const { updatedRequest, auditEntry } =
      await budgetApprovalEscalationService.submitReviewDecision(
        request,
        'reject',
        'Student Union Treasurer',
        'usr-current',
        reason
      );

    setRequests((prev) =>
      prev.map((r) => (r.id === request.id ? updatedRequest : r))
    );
    setAuditLogs((prev) => [auditEntry, ...prev]);
  };

  const handleEscalate = async (request: BudgetApprovalRequest, notes?: string) => {
    const { updatedRequest, auditEntry } =
      await budgetApprovalEscalationService.submitReviewDecision(
        request,
        'escalate_to_admin',
        'Student Union Treasurer',
        'usr-current',
        notes
      );

    setRequests((prev) =>
      prev.map((r) => (r.id === request.id ? updatedRequest : r))
    );
    setAuditLogs((prev) => [auditEntry, ...prev]);
  };

  const handleNewSubmission = async (input: BudgetSubmissionInput) => {
    const { request, auditEntry } =
      await budgetApprovalEscalationService.submitBudget(input);
    setRequests((prev) => [request, ...prev]);
    setAuditLogs((prev) => [auditEntry, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Event Budget Approval Escalation Center
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              Multi-tiered financial rules engine: Instant auto-approvals (&lt;$200),
              Treasurer queue ($200-$2k), and University Admin review (&ge;$2k).
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/25 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Draft Event Budget</span>
          </button>

          <button
            onClick={loadRequests}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition"
            title="Reload Requests"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Grid: Queue on Left (2 cols), Audit Timeline on Right (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <BudgetApprovalQueue
            requests={requests}
            onApprove={handleApprove}
            onReject={handleReject}
            onEscalate={handleEscalate}
          />
        </div>

        <div className="space-y-6">
          <BudgetAuditTrailTimeline logs={auditLogs} />
        </div>
      </div>

      {/* Draft Budget Submission Modal */}
      <BudgetSubmissionEscalationModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSubmit={handleNewSubmission}
      />
    </div>
  );
}
