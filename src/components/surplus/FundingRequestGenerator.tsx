import React, { useState } from "react";
import {
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Edit3,
  Trash2,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import type { FundingRequest, FundingRequestStatus } from "../../types/surplus";
import { CATEGORY_CONFIG } from "./SurplusOptimizer";

// ─── Status Config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  FundingRequestStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  draft: {
    label: "Draft",
    color: "text-slate-400",
    bg: "bg-slate-800/50",
    border: "border-slate-700",
    icon: <Edit3 className="w-3 h-3" />,
  },
  pending: {
    label: "Pending Review",
    color: "text-amber-400",
    bg: "bg-amber-900/50",
    border: "border-amber-800",
    icon: <Clock className="w-3 h-3" />,
  },
  approved: {
    label: "Approved",
    color: "text-emerald-400",
    bg: "bg-emerald-900/50",
    border: "border-emerald-800",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  rejected: {
    label: "Rejected",
    color: "text-red-400",
    bg: "bg-red-900/50",
    border: "border-red-800",
    icon: <XCircle className="w-3 h-3" />,
  },
  executed: {
    label: "Executed",
    color: "text-blue-400",
    bg: "bg-blue-900/50",
    border: "border-blue-800",
    icon: <Sparkles className="w-3 h-3" />,
  },
};

// ─── Funding Request Card ────────────────────────────────────────────────

interface FundingRequestCardProps {
  request: FundingRequest;
  onSubmit: (id: string) => void;
  onDelete: (id: string) => void;
}

const FundingRequestCard: React.FC<FundingRequestCardProps> = ({ request, onSubmit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[request.status];
  const catConfig = CATEGORY_CONFIG[request.category];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${catConfig.bg} ${catConfig.color} ${catConfig.border}`}
            >
              {catConfig.icon}
              {catConfig.label}
            </span>
            <span
              className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.bg} ${status.color} ${status.border}`}
            >
              {status.icon}
              {status.label}
            </span>
          </div>
          <h4 className="text-sm font-bold text-slate-200 mt-1 truncate">{request.title}</h4>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-base font-black font-mono text-emerald-400">
            ${request.amount.toLocaleString()}
          </div>
          <div className="text-[9px] text-slate-500 font-mono">
            {request.submittedAt.toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800/50 pt-3">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
              Description
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">{request.description}</p>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
              Justification
            </span>
            <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">
              {request.justification}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-2.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Submitted By</span>
              <p className="text-xs text-slate-300 mt-0.5">{request.submittedBy}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Submitted</span>
              <p className="text-xs text-slate-300 mt-0.5 font-mono">
                {request.submittedAt.toLocaleDateString()}{" "}
                {request.submittedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          {request.rejectionReason && (
            <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-3">
              <span className="text-[10px] text-red-400 uppercase font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Rejection Reason
              </span>
              <p className="text-xs text-red-300 mt-1">{request.rejectionReason}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/50">
            {request.status === "draft" && (
              <>
                <button
                  onClick={() => onSubmit(request.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold rounded-lg transition-colors"
                >
                  <Send className="w-3 h-3" />
                  Submit for Review
                </button>
                <button
                  onClick={() => onDelete(request.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 hover:bg-red-900/30 hover:border-red-800/50 text-slate-400 hover:text-red-400 text-[10px] font-bold rounded-lg transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </>
            )}
            {request.status === "approved" && (
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg transition-colors">
                <ArrowUpRight className="w-3 h-3" />
                Execute Purchase
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Bulk Actions Bar ────────────────────────────────────────────────────

interface BulkActionsBarProps {
  selectedCount: number;
  totalSelectedCost: number;
  surplus: number;
  onGenerateAll: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  totalCount: number;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  totalSelectedCost,
  surplus,
  onGenerateAll,
  onSelectAll,
  onDeselectAll,
  totalCount,
}) => {
  const overBudget = totalSelectedCost > surplus;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Selected</span>
            <span className="text-sm font-bold text-slate-200">
              {selectedCount} of {totalCount}
            </span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Cost</span>
            <span
              className={`text-sm font-bold font-mono ${overBudget ? "text-red-400" : "text-emerald-400"}`}
            >
              ${totalSelectedCost.toLocaleString()}
              {overBudget && (
                <span className="text-[10px] text-red-400 ml-1">
                  (${(totalSelectedCost - surplus).toLocaleString()} over surplus)
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSelectAll}
            className="text-[10px] text-slate-400 hover:text-white font-bold transition-colors"
          >
            Select All
          </button>
          <button
            onClick={onDeselectAll}
            className="text-[10px] text-slate-400 hover:text-white font-bold transition-colors"
          >
            Deselect All
          </button>
          <button
            onClick={onGenerateAll}
            disabled={selectedCount === 0}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              selectedCount > 0
                ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            <FileText className="w-4 h-4" />
            Generate {selectedCount > 0 ? selectedCount : ""} Request
            {selectedCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Request Summary Panel ───────────────────────────────────────────────

interface RequestSummaryPanelProps {
  requests: FundingRequest[];
}

const RequestSummaryPanel: React.FC<RequestSummaryPanelProps> = ({ requests }) => {
  const statusCounts = requests.reduce(
    (acc, r) => {
      acc[r.status]++;
      return acc;
    },
    { draft: 0, pending: 0, approved: 0, rejected: 0, executed: 0 },
  );

  const totalAmount = requests.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-violet-400" />
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
          Funding Requests
        </h3>
        <span className="text-[10px] text-slate-500 ml-auto font-mono">
          {requests.length} total · ${totalAmount.toLocaleString()}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {(Object.entries(statusCounts) as [FundingRequestStatus, number][]).map(
          ([status, count]) => {
            const cfg = STATUS_CONFIG[status];
            return (
              <div key={status} className="text-center">
                <div className={`text-lg font-black font-mono ${cfg.color}`}>{count}</div>
                <div className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</div>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
};

export { FundingRequestCard, BulkActionsBar, RequestSummaryPanel, STATUS_CONFIG };
