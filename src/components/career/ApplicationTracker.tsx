import React, { useState } from "react";
import {
  BarChart3,
  Clock,
  TrendingUp,
  ChevronRight,
  Filter,
  Search,
  FileText,
  Calendar,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Bookmark,
  Send,
  Star,
  ArrowUpRight,
  Eye,
} from "lucide-react";
import type { Application, ApplicationStatus } from "../../types/career";
import type { ApplicationFilters } from "../../hooks/useCareerSearch";

// ─── Constants ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  saved: {
    label: "Saved",
    color: "text-slate-400",
    bg: "bg-slate-800/50",
    border: "border-slate-700",
    icon: <Bookmark className="w-3.5 h-3.5" />,
  },
  applied: {
    label: "Applied",
    color: "text-blue-400",
    bg: "bg-blue-900/50",
    border: "border-blue-800",
    icon: <Send className="w-3.5 h-3.5" />,
  },
  screening: {
    label: "Screening",
    color: "text-amber-400",
    bg: "bg-amber-900/50",
    border: "border-amber-800",
    icon: <Eye className="w-3.5 h-3.5" />,
  },
  interview: {
    label: "Interview",
    color: "text-violet-400",
    bg: "bg-violet-900/50",
    border: "border-violet-800",
    icon: <MessageSquare className="w-3.5 h-3.5" />,
  },
  offer: {
    label: "Offer",
    color: "text-emerald-400",
    bg: "bg-emerald-900/50",
    border: "border-emerald-800",
    icon: <Star className="w-3.5 h-3.5" />,
  },
  accepted: {
    label: "Accepted",
    color: "text-emerald-300",
    bg: "bg-emerald-900/30",
    border: "border-emerald-700",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  rejected: {
    label: "Rejected",
    color: "text-red-400",
    bg: "bg-red-900/50",
    border: "border-red-800",
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  withdrawn: {
    label: "Withdrawn",
    color: "text-slate-500",
    bg: "bg-slate-900/50",
    border: "border-slate-700",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
};

const PIPELINE_ORDER: ApplicationStatus[] = [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "accepted",
];

// ─── Pipeline Visualization ──────────────────────────────────────────────

const StatusPipeline: React.FC<{ counts: Record<ApplicationStatus, number> }> = ({ counts }) => {
  const total = PIPELINE_ORDER.reduce((sum, s) => sum + counts[s], 0);
  const maxCount = Math.max(...PIPELINE_ORDER.map((s) => counts[s]), 1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-violet-400" />
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
          Application Pipeline
        </h3>
        <span className="text-[10px] text-slate-500 ml-auto font-mono">{total} total</span>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {PIPELINE_ORDER.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const count = counts[status];
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={status} className="text-center">
              <div className="relative h-20 bg-slate-800 rounded-lg overflow-hidden mb-1.5">
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-violet-600/30 to-transparent transition-all duration-500"
                  style={{ height: `${(count / maxCount) * 100}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-lg font-black font-mono ${cfg.color}`}>{count}</span>
                </div>
              </div>
              <div className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</div>
              <div className="text-[9px] text-slate-600">{pct.toFixed(0)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Application Card ────────────────────────────────────────────────────

interface ApplicationCardProps {
  application: Application;
  onSelect: (app: Application) => void;
}

const ApplicationCard: React.FC<ApplicationCardProps> = ({ application, onSelect }) => {
  const status = STATUS_CONFIG[application.status];

  return (
    <div
      className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all cursor-pointer group"
      onClick={() => onSelect(application)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-black text-slate-400 overflow-hidden flex-shrink-0">
            {application.job.company.logo ? (
              <img
                src={application.job.company.logo}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              application.job.company.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors">
              {application.job.title}
            </h4>
            <p className="text-xs text-slate-400">{application.job.company.name}</p>
          </div>
        </div>

        <span
          className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${status.bg} ${status.color} ${status.border}`}
        >
          {status.icon}
          {status.label}
        </span>
      </div>

      {/* Mini Timeline */}
      {application.timeline.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3 overflow-x-auto">
          {application.timeline.slice(-4).map((event, i) => {
            const cfg = STATUS_CONFIG[event.status];
            return (
              <React.Fragment key={event.id}>
                {i > 0 && <ChevronRight className="w-3 h-3 text-slate-700 flex-shrink-0" />}
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color} ${cfg.border} whitespace-nowrap flex items-center gap-1`}
                >
                  {cfg.icon}
                  {cfg.label}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Bottom Row */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/50">
        <div className="flex items-center gap-3">
          {application.nextStep && (
            <span className="text-[10px] text-violet-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {application.nextStep}
              {application.nextStepDate && (
                <span className="text-slate-500 ml-1">
                  {application.nextStepDate.toLocaleDateString()}
                </span>
              )}
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-500">
          Applied {application.appliedAt.toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};

// ─── Application Detail Modal ────────────────────────────────────────────

interface ApplicationDetailModalProps {
  application: Application;
  onClose: () => void;
  onStatusChange: (appId: string, newStatus: ApplicationStatus) => void;
}

const ApplicationDetailModal: React.FC<ApplicationDetailModalProps> = ({
  application,
  onClose,
  onStatusChange,
}) => {
  const status = STATUS_CONFIG[application.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-100">{application.job.title}</h3>
              <p className="text-sm text-slate-400 mt-0.5">{application.job.company.name}</p>
            </div>
            <span
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${status.bg} ${status.color} ${status.border}`}
            >
              {status.icon}
              {status.label}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="p-5 space-y-4">
          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Applied</span>
              <p className="text-sm text-slate-200 font-mono mt-0.5">
                {application.appliedAt.toLocaleDateString()}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Last Updated</span>
              <p className="text-sm text-slate-200 font-mono mt-0.5">
                {application.updatedAt.toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Next Step */}
          {application.nextStep && (
            <div className="bg-violet-900/20 border border-violet-800/30 rounded-xl p-3">
              <span className="text-[10px] text-violet-400 uppercase font-bold flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Next Step
              </span>
              <p className="text-sm text-slate-200 mt-1">{application.nextStep}</p>
              {application.nextStepDate && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {application.nextStepDate.toLocaleDateString()} at{" "}
                  {application.nextStepDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          {application.notes && (
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Notes
              </span>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">{application.notes}</p>
            </div>
          )}

          {/* Timeline */}
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1 mb-3">
              <Clock className="w-3 h-3" />
              Activity Timeline
            </span>
            <div className="relative pl-4">
              <div className="absolute left-1.5 top-1 bottom-1 w-px bg-slate-800" />
              {application.timeline.map((event) => {
                const cfg = STATUS_CONFIG[event.status];
                return (
                  <div key={event.id} className="relative mb-3 last:mb-0">
                    <div
                      className={`absolute -left-2.5 top-1 w-3 h-3 rounded-full border-2 border-slate-900 ${cfg.bg}`}
                    />
                    <div className="ml-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-[10px] text-slate-600 font-mono">
                          {event.timestamp.toLocaleDateString()}
                        </span>
                      </div>
                      {event.note && <p className="text-xs text-slate-400 mt-0.5">{event.note}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Change */}
          <div className="pt-2 border-t border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-bold mb-2 block">
              Update Status
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PIPELINE_ORDER.map((s) => {
                const cfg = STATUS_CONFIG[s];
                const isActive = s === application.status;
                return (
                  <button
                    key={s}
                    onClick={() => {
                      onStatusChange(application.id, s);
                      onClose();
                    }}
                    disabled={isActive}
                    className={`text-[10px] px-2.5 py-1 rounded-full border font-bold transition-colors ${
                      isActive
                        ? `${cfg.bg} ${cfg.color} ${cfg.border} opacity-50 cursor-not-allowed`
                        : `bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600`
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Export ──────────────────────────────────────────────────────────────

export { StatusPipeline, ApplicationCard, ApplicationDetailModal, STATUS_CONFIG, PIPELINE_ORDER };
