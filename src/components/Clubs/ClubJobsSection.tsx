import { useState } from "react";
import { useClubJobs } from "@/hooks/useClubJobs";
import Briefcase from "lucide-react/dist/esm/icons/briefcase";
import Send from "lucide-react/dist/esm/icons/send";
import X from "lucide-react/dist/esm/icons/x";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Clock from "lucide-react/dist/esm/icons/clock";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface ClubJobsSectionProps {
  clubId: string;
}

export function ClubJobsSection({ clubId }: ClubJobsSectionProps) {
  const { openJobs, isLoading, applyToJob } = useClubJobs(clubId);
  const [selectedJob, setSelectedJob] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [applicationText, setApplicationText] = useState("");

  const handleApply = async () => {
    if (!selectedJob) return;
    if (!applicationText.trim()) {
      toast.error("Please write an application");
      return;
    }
    applyToJob.mutate(
      { jobId: selectedJob.id, applicationText: applicationText.trim() },
      {
        onSuccess: () => {
          setSelectedJob(null);
          setApplicationText("");
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="neu-border bg-white p-6 mt-8">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 w-48" />
          <div className="h-20 bg-gray-100" />
          <div className="h-20 bg-gray-100" />
        </div>
      </div>
    );
  }

  if (openJobs.length === 0) return null;

  return (
    <section className="px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="neu-border bg-white p-6">
          <h2 className="mb-4 border-b-2 border-black pb-3 text-xl font-bold text-black flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-brand-blue-base" />
            Open Positions
          </h2>
          <div className="space-y-4">
            {openJobs.map((job) => (
              <div
                key={job.id}
                className="border-2 border-black p-4 hover:bg-cream transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-lg">{job.title}</h3>
                    <p className="font-mono text-sm text-gray-600 mt-1 line-clamp-3">
                      {job.description}
                    </p>
                    <p className="font-mono text-xs text-gray-400 mt-2">
                      {job.applicant_count} applicant{job.applicant_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {job.user_application_status === "pending" ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-800 font-mono text-xs font-bold uppercase border-2 border-amber-600">
                        <Clock className="h-3 w-3" /> Applied
                      </span>
                    ) : job.user_application_status === "accepted" ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-800 font-mono text-xs font-bold uppercase border-2 border-green-600">
                        <CheckCircle className="h-3 w-3" /> Accepted
                      </span>
                    ) : job.user_application_status === "rejected" ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-800 font-mono text-xs font-bold uppercase border-2 border-red-600">
                        <AlertCircle className="h-3 w-3" /> Rejected
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          const supabase = createClient();
                          const {
                            data: { user },
                          } = await supabase.auth.getUser();
                          if (!user) return void toast.error("Please sign in first");
                          setSelectedJob({ id: job.id, title: job.title });
                        }}
                        className="neu-border neu-press bg-black text-cream px-4 py-2 font-mono text-xs font-bold uppercase hover:-translate-y-1 transition-transform inline-flex items-center gap-1"
                      >
                        <Send className="h-3 w-3" /> Apply
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!selectedJob}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJob(null);
            setApplicationText("");
          }
        }}
      >
        <AlertDialogContent className="max-w-lg border-2 border-black bg-white rounded-none p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-bold flex items-center gap-2">
              <Send className="h-5 w-5 text-brand-blue-base" />
              Apply for {selectedJob?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-sm text-gray-700">
              Write a brief message explaining why you are a good fit for this position.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <textarea
            value={applicationText}
            onChange={(e) => setApplicationText(e.target.value)}
            placeholder="Tell us about your relevant experience and why you'd like to join..."
            className="neu-border w-full p-3 font-mono text-sm min-h-[150px] mt-4"
            required
          />

          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="neu-border rounded-none font-mono text-xs font-bold uppercase bg-white text-black hover:bg-cream">
              Cancel
            </AlertDialogCancel>
            <button
              type="button"
              onClick={handleApply}
              disabled={applyToJob.isPending || !applicationText.trim()}
              className="neu-border neu-press bg-black text-cream px-5 py-2 font-mono text-xs font-bold uppercase disabled:opacity-50 inline-flex items-center gap-2"
            >
              {applyToJob.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {applyToJob.isPending ? "Submitting..." : "Submit Application"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
