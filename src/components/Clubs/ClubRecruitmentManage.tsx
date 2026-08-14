import { useState } from "react";
import { useClubJobs, useJobApplications } from "@/hooks/useClubJobs";
import Briefcase from "lucide-react/dist/esm/icons/briefcase";
import Plus from "lucide-react/dist/esm/icons/plus";
import X from "lucide-react/dist/esm/icons/x";
import Users from "lucide-react/dist/esm/icons/users";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import XCircle from "lucide-react/dist/esm/icons/xcircle";
import Clock from "lucide-react/dist/esm/icons/clock";
import Eye from "lucide-react/dist/esm/icons/eye";
import EyeOff from "lucide-react/dist/esm/icons/eye-off";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import { toast } from "sonner";

interface ClubRecruitmentManageProps {
  clubId: string;
}

export function ClubRecruitmentManage({ clubId }: ClubRecruitmentManageProps) {
  const { jobs, isLoading, createJob, toggleJobStatus, deleteJob } = useClubJobs(clubId);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Enter a job title");
      return;
    }
    if (!formDescription.trim()) {
      toast.error("Enter a job description");
      return;
    }
    createJob.mutate(
      {
        club_id: clubId,
        title: formTitle.trim(),
        description: formDescription.trim(),
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setFormTitle("");
          setFormDescription("");
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-2 border-black bg-cream p-4 shadow-[4px_4px_0_0_#000] dark:bg-zinc-800 dark:border-white">
        <div>
          <h2 className="font-display font-black text-xl uppercase tracking-wide flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-brand-blue-base" />
            Recruitment
          </h2>
          <p className="font-mono text-xs text-gray-600 dark:text-gray-300 mt-1">
            Post open positions and review applicant submissions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="neu-border neu-press bg-lime text-black px-4 py-2 font-mono text-xs font-bold uppercase flex items-center gap-2 hover:-translate-y-1 transition-transform"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "New Position"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreateJob}
          className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white space-y-4"
        >
          <h3 className="font-display font-black text-base uppercase">Post a New Position</h3>
          <div>
            <label className="font-mono text-xs font-bold uppercase mb-1 block">Title</label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Web Developer, Treasurer"
              className="neu-border w-full p-2 font-mono text-sm"
              required
            />
          </div>
          <div>
            <label className="font-mono text-xs font-bold uppercase mb-1 block">Description</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Describe the role, responsibilities, and any requirements..."
              className="neu-border w-full p-2 font-mono text-sm min-h-[100px]"
              required
            />
          </div>
          <button
            type="submit"
            disabled={createJob.isPending}
            className="neu-border neu-press w-full bg-black text-white p-3 font-mono text-sm font-bold uppercase transition-transform hover:-translate-y-1 disabled:opacity-50"
          >
            {createJob.isPending ? "Posting..." : "Post Position"}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 border-2 border-black bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="border-2 border-black bg-white p-8 text-center font-mono text-sm text-gray-500">
          No positions posted yet. Click "New Position" to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isExpanded={expandedJobId === job.id}
              onToggleExpand={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
              onToggleStatus={() => toggleJobStatus.mutate({ jobId: job.id, isOpen: !job.is_open })}
              onDelete={() => deleteJob.mutate(job.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({
  job,
  isExpanded,
  onToggleExpand,
  onToggleStatus,
  onDelete,
}: {
  job: {
    id: string;
    title: string;
    description: string;
    is_open: boolean;
    applicant_count: number;
  };
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border-2 border-black bg-white shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white">
      <div className="p-4 flex items-start justify-between gap-4">
        <div
          className="flex-1 min-w-0"
          role="button"
          tabIndex={0}
          onClick={onToggleExpand}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggleExpand();
            }
          }}
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
            <h3 className="font-display font-bold text-base">{job.title}</h3>
          </div>
          <p className="font-mono text-xs text-gray-500 mt-1 line-clamp-2">{job.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                job.is_open
                  ? "bg-green-100 text-green-800 border border-green-600"
                  : "bg-gray-100 text-gray-600 border border-gray-400"
              }`}
            >
              {job.is_open ? "Open" : "Closed"}
            </span>
            <span className="font-mono text-[10px] text-gray-500 flex items-center gap-1">
              <Users className="h-3 w-3" />
              {job.applicant_count} applicant{job.applicant_count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleStatus}
            title={job.is_open ? "Close position" : "Reopen position"}
            className="neu-border p-2 font-mono text-xs hover:bg-gray-100 transition-colors"
          >
            {job.is_open ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete position"
            className="neu-border p-2 font-mono text-xs hover:bg-red-100 transition-colors text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isExpanded && <ApplicantList jobId={job.id} />}
    </div>
  );
}

function ApplicantList({ jobId }: { jobId: string }) {
  const { applications, isLoading, updateStatus } = useJobApplications(jobId);

  if (isLoading) {
    return (
      <div className="border-t-2 border-black p-4 bg-gray-50 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="border-t-2 border-black p-4 bg-gray-50 font-mono text-xs text-gray-500 text-center">
        No applications yet.
      </div>
    );
  }

  return (
    <div className="border-t-2 border-black">
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-black">
              <th className="p-2 border-r border-gray-300">Applicant</th>
              <th className="p-2 border-r border-gray-300">Message</th>
              <th className="p-2 border-r border-gray-300">Date</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {applications.map((app) => (
              <tr key={app.id} className="hover:bg-cream">
                <td className="p-2 border-r border-gray-200 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {app.user_avatar ? (
                      <img
                        src={app.user_avatar}
                        alt={app.user_name}
                        className="h-6 w-6 rounded-full border border-black"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full border border-black bg-gray-200 flex items-center justify-center text-[8px] font-bold">
                        {app.user_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-bold">{app.user_name}</p>
                      {app.user_handle && (
                        <p className="text-[10px] text-gray-500">@{app.user_handle}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-2 border-r border-gray-200 max-w-[250px]">
                  <p className="line-clamp-3 whitespace-pre-wrap">{app.application_text}</p>
                </td>
                <td className="p-2 border-r border-gray-200 whitespace-nowrap">
                  {new Date(app.created_at).toLocaleDateString()}
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {app.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            updateStatus.mutate({
                              applicationId: app.id,
                              status: "accepted",
                            })
                          }
                          className="neu-border neu-press bg-green-100 text-green-800 px-2 py-1 font-mono text-[10px] font-bold uppercase hover:bg-green-200 flex items-center gap-1"
                        >
                          <CheckCircle className="h-3 w-3" /> Accept
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateStatus.mutate({
                              applicationId: app.id,
                              status: "rejected",
                            })
                          }
                          className="neu-border neu-press bg-red-100 text-red-800 px-2 py-1 font-mono text-[10px] font-bold uppercase hover:bg-red-200 flex items-center gap-1"
                        >
                          <XCircle className="h-3 w-3" /> Reject
                        </button>
                      </>
                    ) : app.status === "accepted" ? (
                      <span className="flex items-center gap-1 text-green-700 font-bold text-[10px] uppercase">
                        <CheckCircle className="h-3 w-3" /> Accepted
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-700 font-bold text-[10px] uppercase">
                        <XCircle className="h-3 w-3" /> Rejected
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
