import React, { useState } from "react";
import {
  MapPin,
  Clock,
  DollarSign,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Users,
  Zap,
  Building2,
  Briefcase,
  Globe,
  ChevronDown,
  ChevronUp,
  Calendar,
  ArrowUpRight,
} from "lucide-react";
import type { JobListing } from "../../types/career";

// ─── Helpers ─────────────────────────────────────────────────────────────

const JOB_TYPE_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  internship: { bg: "bg-blue-900/50", text: "text-blue-400", border: "border-blue-800" },
  "full-time": { bg: "bg-emerald-900/50", text: "text-emerald-400", border: "border-emerald-800" },
  "part-time": { bg: "bg-amber-900/50", text: "text-amber-400", border: "border-amber-800" },
  "co-op": { bg: "bg-violet-900/50", text: "text-violet-400", border: "border-violet-800" },
  contract: { bg: "bg-slate-800/50", text: "text-slate-400", border: "border-slate-700" },
};

const REMOTE_ICONS: Record<string, string> = {
  remote: "🌍",
  hybrid: "🔄",
  "on-site": "🏢",
};

function formatSalary(salary: { min: number; max: number; currency: string }): string {
  const fmt = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`);
  return `${fmt(salary.min)} – ${fmt(salary.max)}`;
}

function daysUntil(date: Date): number {
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

// ─── Component ───────────────────────────────────────────────────────────

interface JobListingCardProps {
  job: JobListing;
  onToggleSave: (jobId: string) => void;
  onApply: (job: JobListing) => void;
}

const JobListingCard: React.FC<JobListingCardProps> = ({ job, onToggleSave, onApply }) => {
  const [expanded, setExpanded] = useState(false);
  const badge = JOB_TYPE_BADGES[job.type] ?? JOB_TYPE_BADGES.contract;
  const deadlineDays = job.deadline ? daysUntil(job.deadline) : null;

  return (
    <div
      className={`group bg-slate-900 border rounded-2xl p-5 transition-all duration-200 ${
        job.isUrgent
          ? "border-amber-700/50 hover:border-amber-600"
          : "border-slate-800 hover:border-slate-700"
      }`}
    >
      {/* Top Row: Company + Save */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Company logo placeholder */}
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg font-black text-slate-400 flex-shrink-0 overflow-hidden">
            {job.company.logo ? (
              <img
                src={job.company.logo}
                alt={job.company.name}
                className="w-full h-full object-cover"
              />
            ) : (
              job.company.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors">
                {job.title}
              </h3>
              {job.isUrgent && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-900/60 text-amber-400 font-bold border border-amber-800 animate-pulse">
                  <Zap className="w-2.5 h-2.5 inline mr-0.5" />
                  Urgent
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400">{job.company.name}</span>
              {job.company.verified && (
                <span className="text-[9px] text-emerald-400 font-bold">✓ Verified</span>
              )}
              <span className="text-slate-700">·</span>
              <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                <Building2 className="w-2.5 h-2.5" />
                {job.company.size}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onToggleSave(job.id)}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-violet-400 transition-colors flex-shrink-0"
          title={job.isSaved ? "Unsave" : "Save job"}
        >
          {job.isSaved ? (
            <BookmarkCheck className="w-5 h-5 text-violet-400" />
          ) : (
            <Bookmark className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Meta Row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
        {/* Type badge */}
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
        >
          {job.type.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>

        {/* Location */}
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {job.location}
        </span>

        {/* Remote */}
        <span className="text-xs text-slate-500">
          {REMOTE_ICONS[job.remotePolicy]} {job.remotePolicy}
        </span>

        {/* Salary */}
        {job.salary && (
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {formatSalary(job.salary)}
          </span>
        )}

        {/* Deadline */}
        {deadlineDays !== null && (
          <span
            className={`text-[10px] flex items-center gap-1 font-bold ${
              deadlineDays <= 3
                ? "text-red-400"
                : deadlineDays <= 7
                  ? "text-amber-400"
                  : "text-slate-500"
            }`}
          >
            <Calendar className="w-3 h-3" />
            {deadlineDays <= 0 ? "Expired" : `${deadlineDays}d left`}
          </span>
        )}
      </div>

      {/* Brief Description */}
      <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed">{job.description}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {job.tags.slice(0, expanded ? undefined : 4).map((tag) => (
          <span
            key={tag}
            className="text-[10px] px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-400"
          >
            {tag}
          </span>
        ))}
        {!expanded && job.tags.length > 4 && (
          <span className="text-[10px] px-2 py-0.5 text-slate-500">
            +{job.tags.length - 4} more
          </span>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Requirements
            </h4>
            <ul className="space-y-1">
              {job.requirements.map((req, i) => (
                <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  {req}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Benefits
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {job.benefits.map((benefit) => (
                <span
                  key={benefit}
                  className="text-[10px] px-2 py-0.5 bg-emerald-900/30 border border-emerald-800/50 rounded-full text-emerald-400"
                >
                  {benefit}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Row */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/50">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Users className="w-3 h-3" />
            {job.applicantsCount} applicants
          </span>
          <span className="text-[10px] text-slate-600">·</span>
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Posted {job.postedAt.toLocaleDateString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5 transition-colors"
          >
            {expanded ? (
              <>
                Less <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                Details <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
          <button
            onClick={() => onApply(job)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-violet-600/20"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobListingCard;
