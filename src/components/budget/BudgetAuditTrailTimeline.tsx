/**
 * Budget Audit Trail Timeline Component
 * Issue #4287
 * Displays immutable audit log for budget requests with state transitions and system tags.
 */

import React from 'react';
import { BudgetAuditTrailEntry } from '../../types/budgetApprovalEscalation';
import {
  History,
  CheckCircle,
  Clock,
  ShieldAlert,
  Sparkles,
  Tag,
} from 'lucide-react';

interface BudgetAuditTrailTimelineProps {
  logs: BudgetAuditTrailEntry[];
}

export const BudgetAuditTrailTimeline: React.FC<BudgetAuditTrailTimelineProps> = ({
  logs,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 text-slate-100 shadow-xl">
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <History className="w-5 h-5 text-blue-400" />
        <h4 className="font-bold text-sm">Financial Escalation Audit Ledger</h4>
      </div>

      <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {logs.map((entry) => (
          <div key={entry.id} className="relative flex items-start space-x-3 pl-8 text-xs">
            {/* Timeline node icon */}
            <div className="absolute left-1.5 top-0.5 w-3.5 h-3.5 rounded-full bg-slate-800 border-2 border-emerald-400 flex items-center justify-center"></div>

            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 w-full space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
                  {entry.action.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(entry.created_at).toLocaleTimeString()}
                </span>
              </div>

              <p className="text-slate-300">{entry.notes}</p>

              <div className="flex items-center justify-between pt-1 border-t border-slate-700/60 text-[10px] text-slate-400">
                <span>Actor: {entry.actor_name}</span>
                {entry.audit_tag && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 text-emerald-400 font-mono font-bold">
                    {entry.audit_tag}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
