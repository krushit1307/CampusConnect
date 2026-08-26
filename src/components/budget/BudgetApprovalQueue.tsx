/**
 * Role-Based Budget Approval Queue Component
 * Issue #4287
 * Manages separate queues for Student Union Treasurer ($200 - $2,000) and
 * University Admin ($2,000+) along with System_Auto_Approved logs.
 */

import React, { useState } from 'react';
import {
  BudgetApprovalRequest,
  BudgetAssignedQueue,
  BudgetApprovalStatus,
} from '../../types/budgetApprovalEscalation';
import {
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Sparkles,
  DollarSign,
  FileText,
  Clock,
  Building,
  ShieldAlert,
  Search,
} from 'lucide-react';

interface BudgetApprovalQueueProps {
  requests: BudgetApprovalRequest[];
  onApprove: (request: BudgetApprovalRequest, notes?: string) => Promise<void>;
  onReject: (request: BudgetApprovalRequest, reason: string) => Promise<void>;
  onEscalate: (request: BudgetApprovalRequest, notes?: string) => Promise<void>;
}

export const BudgetApprovalQueue: React.FC<BudgetApprovalQueueProps> = ({
  requests,
  onApprove,
  onReject,
  onEscalate,
}) => {
  const [activeTab, setActiveTab] = useState<
    'student_union_treasurer' | 'university_admin' | 'auto_approved' | 'all'
  >('student_union_treasurer');
  const [selectedRequest, setSelectedRequest] =
    useState<BudgetApprovalRequest | null>(null);
  const [rejectionModalRequest, setRejectionModalRequest] =
    useState<BudgetApprovalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.event_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.club_name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'student_union_treasurer') {
      return r.assigned_queue === 'student_union_treasurer';
    }
    if (activeTab === 'university_admin') {
      return r.assigned_queue === 'university_admin';
    }
    if (activeTab === 'auto_approved') {
      return r.is_auto_approved || r.approval_status === 'system_auto_approved';
    }
    return true;
  });

  const treasurerPendingCount = requests.filter(
    (r) => r.assigned_queue === 'student_union_treasurer' && r.approval_status === 'pending_treasurer'
  ).length;

  const adminPendingCount = requests.filter(
    (r) => r.assigned_queue === 'university_admin' && r.approval_status === 'pending_admin'
  ).length;

  const autoApprovedCount = requests.filter(
    (r) => r.is_auto_approved || r.approval_status === 'system_auto_approved'
  ).length;

  return (
    <div className="space-y-6 text-slate-100">
      {/* Tier Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Auto Approval Banner */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
            <span>&lt; $200 Micro Tier</span>
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">{autoApprovedCount}</div>
          <p className="text-[11px] text-slate-400">
            Instant System Auto-Approved (<code className="text-emerald-400 font-mono">System_Auto_Approved</code>)
          </p>
        </div>

        {/* Student Union Treasurer Queue */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-blue-500/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-blue-400 font-semibold">
            <span>$200 – $2,000 Mid Tier</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">{treasurerPendingCount} Pending</div>
          <p className="text-[11px] text-slate-400">
            Routed to Student Union Treasurer (48h SLA)
          </p>
        </div>

        {/* University Admin Queue */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-rose-500/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-rose-400 font-semibold">
            <span>&ge; $2,000 High Value Tier</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">{adminPendingCount} Pending</div>
          <p className="text-[11px] text-slate-400">
            Routed to University Admin Governance
          </p>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setActiveTab('student_union_treasurer')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition ${
              activeTab === 'student_union_treasurer'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Treasurer Queue ({treasurerPendingCount})
          </button>

          <button
            onClick={() => setActiveTab('university_admin')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition ${
              activeTab === 'university_admin'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            University Admin Queue ({adminPendingCount})
          </button>

          <button
            onClick={() => setActiveTab('auto_approved')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition ${
              activeTab === 'auto_approved'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            System Auto-Approved ({autoApprovedCount})
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition ${
              activeTab === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Logs ({requests.length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search event or club..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Event & Organization</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Tier & Escalation Tag</th>
                <th className="py-3 px-4">Approval Status</th>
                <th className="py-3 px-4">Submitted By</th>
                <th className="py-3 px-4 text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-4 space-y-0.5">
                    <div className="font-semibold text-slate-100">{req.event_title}</div>
                    <div className="text-slate-400 font-mono text-[11px]">{req.club_name}</div>
                  </td>

                  <td className="py-3.5 px-4 font-mono font-bold text-sm text-slate-100">
                    ${req.total_amount.toFixed(2)}
                  </td>

                  <td className="py-3.5 px-4 space-y-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        req.tier_category === 'micro_tier'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : req.tier_category === 'mid_tier'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {req.tier_category.replace(/_/g, ' ')}
                    </span>
                    <div className="font-mono text-[10px] text-slate-500">{req.audit_tag}</div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        req.approval_status === 'system_auto_approved'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : req.approval_status === 'approved'
                          ? 'bg-emerald-600/15 text-emerald-400 border-emerald-500/30'
                          : req.approval_status === 'rejected'
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : req.approval_status === 'pending_treasurer'
                          ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          : 'bg-rose-600/15 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {req.approval_status.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-slate-400">
                    <div>{req.submitted_by_name}</div>
                    <div className="text-[10px]">{new Date(req.submitted_at).toLocaleDateString()}</div>
                  </td>

                  <td className="py-3.5 px-4 text-right space-x-1.5">
                    <button
                      onClick={() => setSelectedRequest(req)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-[11px]"
                    >
                      Line Items
                    </button>

                    {!req.is_auto_approved &&
                      req.approval_status !== 'approved' &&
                      req.approval_status !== 'rejected' && (
                        <>
                          <button
                            onClick={() => onApprove(req)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-[11px]"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectionModalRequest(req)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-[11px]"
                          >
                            Reject
                          </button>
                          {req.assigned_queue === 'student_union_treasurer' && (
                            <button
                              onClick={() => onEscalate(req, 'Escalated to University Admin')}
                              className="px-2 py-1 bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40 rounded-lg text-[11px]"
                              title="Escalate to Admin"
                            >
                              Escalate
                            </button>
                          )}
                        </>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Line Items Inspection Drawer */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-sm text-slate-100">
                  {selectedRequest.event_title} - Budget Breakdown
                </h4>
                <p className="text-xs text-slate-400">{selectedRequest.club_name}</p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs">
              {selectedRequest.line_items.map((li, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-200 block">{li.description}</span>
                    <span className="text-[11px] text-slate-400 capitalize">
                      Category: {li.category.replace(/_/g, ' ')} ({li.quantity} × ${li.unit_cost.toFixed(2)})
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-200">
                    ${li.total_cost.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm font-bold text-emerald-400">
              <span>Total Request Amount:</span>
              <span>${selectedRequest.total_amount.toFixed(2)}</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectionModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100">
            <h4 className="font-bold text-sm text-rose-400 flex items-center space-x-2">
              <XCircle className="w-4 h-4" />
              <span>Reject Event Budget Allocation</span>
            </h4>
            <p className="text-xs text-slate-400">
              Specify the budgetary policy reason for rejecting {rejectionModalRequest.event_title}:
            </p>

            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Exceeds maximum catering cap for student networking events or missing itemized vendor receipt."
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            />

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setRejectionModalRequest(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onReject(rejectionModalRequest, rejectionReason);
                  setRejectionModalRequest(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
