import React, { useState } from "react";
import {
  Briefcase,
  Search,
  Plus,
  Lock,
  ExternalLink,
  MapPin,
  Clock,
  Trash2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  ClubJobPosting,
  getCompanyLogoUrl,
  getDaysUntilExpiration,
  isJobPostingExpired,
  calculateRenewedExpirationDate,
} from "@/lib/alumniJobBoard";
import { CreateJobPostingModal } from "./CreateJobPostingModal";
import { cn } from "@/lib/utils";

export interface AlumniJobBoardTabProps {
  clubId: string;
  clubName?: string;
  isMember?: boolean;
  isAlumniOrLeader?: boolean;
  postings?: ClubJobPosting[];
  onAddPosting?: (posting: Omit<ClubJobPosting, "id" | "created_at" | "expires_at">) => void;
  onDeletePosting?: (id: string) => void;
  onRenewPosting?: (id: string, newExpiresAt: string) => void;
  className?: string;
}

export const AlumniJobBoardTab: React.FC<AlumniJobBoardTabProps> = ({
  clubId,
  clubName = "Campus Club",
  isMember = true,
  isAlumniOrLeader = true,
  postings = [],
  onAddPosting,
  onDeletePosting,
  onRenewPosting,
  className,
}) => {
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [localPostings, setLocalPostings] = useState<ClubJobPosting[]>(postings);

  // Sync props to state if passed dynamically
  React.useEffect(() => {
    setLocalPostings(postings);
  }, [postings]);

  // Member Access Lock Check (#2992)
  if (!isMember) {
    return (
      <div
        data-testid="job-board-locked"
        className="border-2 border-black p-8 bg-amber-50 rounded-xl text-center space-y-4 font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      >
        <div className="w-12 h-12 bg-amber-200 border-2 border-black rounded-full flex items-center justify-center mx-auto text-amber-900">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold">Exclusive Alumni Opportunities</h3>
        <p className="text-sm font-sans text-gray-700 max-w-md mx-auto">
          The {clubName} Alumni Job Board is restricted strictly to active, verified club members. Join {clubName} to access exclusive referral opportunities from alumni at top companies!
        </p>
      </div>
    );
  }

  const handleCreateSubmit = (newPost: Omit<ClubJobPosting, "id" | "created_at" | "expires_at">) => {
    const created: ClubJobPosting = {
      ...newPost,
      id: `job-${Date.now()}`,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    setLocalPostings((prev) => [created, ...prev]);
    if (onAddPosting) onAddPosting(newPost);
  };

  const handleDelete = (id: string) => {
    setLocalPostings((prev) => prev.filter((p) => p.id !== id));
    if (onDeletePosting) onDeletePosting(id);
  };

  const handleRenew = (id: string, currentExpiresAt: string) => {
    const newExpiresAt = calculateRenewedExpirationDate(currentExpiresAt);
    setLocalPostings((prev) =>
      prev.map((p) => (p.id === id ? { ...p, expires_at: newExpiresAt, is_renewed: true } : p))
    );
    if (onRenewPosting) onRenewPosting(id, newExpiresAt);
  };

  const filteredPostings = localPostings.filter((job) => {
    if (isJobPostingExpired(job.expires_at)) return false;
    if (query && !job.title.toLowerCase().includes(query.toLowerCase()) && !job.company.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }
    if (filterType !== "all" && job.job_type !== filterType) {
      return false;
    }
    return true;
  });

  return (
    <div className={cn("space-y-6 font-mono", className)}>
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-2 border-black p-5 bg-purple-50 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-purple-950">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span>{clubName} Alumni Job Board</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Exclusive internships & positions posted directly by verified club alumni for active members.
          </p>
        </div>

        {isAlumniOrLeader && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 border-2 border-black bg-purple-600 text-white text-xs font-bold uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-purple-700 transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Post Opportunity
          </button>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by role title, company..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border-2 border-black bg-white font-sans text-xs rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "Full-time", "Internship", "Part-time"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={cn(
                "px-3 py-2 border-2 border-black text-xs font-bold capitalize rounded-md transition-all",
                filterType === type ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Job Postings Grid */}
      {filteredPostings.length === 0 ? (
        <div className="border-2 border-black p-8 bg-white rounded-xl text-center space-y-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <Briefcase className="w-10 h-10 text-gray-400 mx-auto" />
          <h4 className="font-bold text-sm">No Active Opportunities Found</h4>
          <p className="text-xs font-sans text-gray-600">
            Check back soon or ask alumni in your club network to share their opening positions!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPostings.map((job) => {
            const daysLeft = getDaysUntilExpiration(job.expires_at);
            const logo = getCompanyLogoUrl(job.company_domain || job.company);

            return (
              <div
                key={job.id}
                data-testid="job-posting-card"
                className="border-2 border-black p-5 bg-white rounded-xl space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={logo}
                        alt={`${job.company} logo`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/identicon/svg?seed=Company";
                        }}
                        className="w-10 h-10 object-contain bg-white border border-black rounded-md p-1 shrink-0"
                      />
                      <div>
                        <h4 className="font-bold text-base font-sans text-black leading-tight">{job.title}</h4>
                        <span className="text-xs font-bold text-purple-700">{job.company}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase border border-black rounded bg-purple-100 text-purple-900 shrink-0">
                      {job.job_type}
                    </span>
                  </div>

                  <p className="text-xs font-sans text-gray-700 line-clamp-3 leading-relaxed">
                    {job.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-600 pt-1 border-t">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-500" />
                      {job.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      {daysLeft} days remaining
                    </span>
                  </div>
                </div>

                {/* Footer Action & Moderation Buttons */}
                <div className="flex items-center justify-between pt-3 mt-2 border-t-2 border-black/10">
                  <div className="flex items-center gap-2">
                    {isAlumniOrLeader && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRenew(job.id, job.expires_at)}
                          title="Renew 30-day listing expiration"
                          className="p-1.5 border border-black text-gray-700 hover:bg-purple-100 rounded"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(job.id)}
                          title="Delete/Moderate posting"
                          className="p-1.5 border border-black text-rose-600 hover:bg-rose-100 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  <a
                    href={job.apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 border-2 border-black bg-black text-white text-xs font-bold uppercase rounded hover:bg-gray-800 transition-colors flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    Apply Exclusively
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for publishing new opportunity */}
      <CreateJobPostingModal
        isOpen={isCreateOpen}
        clubId={clubId}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateSubmit}
      />
    </div>
  );
};
