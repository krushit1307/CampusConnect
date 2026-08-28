import { useEffect, useState } from "react";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface ReviewRecord {
  id: string;
  club_id: string;
  member_id: string;
  desired_role_id: string | null;
  status: "consider";
  created_at: string;
  completed_at: string | null;
  clubs: { name: string } | { name: string }[] | null;
  club_members:
    | {
        profiles:
          | { full_name: string | null; email: string | null }
          | { full_name: string | null; email: string | null }[]
          | null;
      }
    | { profiles: { full_name: string | null; email: string | null }[] | null }[]
    | null;
}

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}

export function LeadershipBackgroundCheckReviewQueue() {
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const supabase = createClient();

  const load = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("club_leadership_background_checks")
      .select(
        "id, club_id, member_id, desired_role_id, status, created_at, completed_at, clubs(name), club_members(profiles(full_name, email))",
      )
      .eq("status", "consider")
      .order("completed_at", { ascending: true });
    if (error) toast.error(error.message);
    setRecords((data as ReviewRecord[] | null) || []);
    setIsLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const decide = async (record: ReviewRecord, decision: "clear" | "failed") => {
    setBusyId(record.id);
    try {
      const { data, error } = await supabase.functions.invoke("club-leadership-background-check", {
        body: { action: "review", check_id: record.id, decision },
      });
      if (error || data?.error) throw error || new Error(data.error);
      toast.success(
        decision === "clear"
          ? "Leadership role approved after manual review."
          : "Leadership role declined after manual review.",
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the review.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="neu-border bg-[#fff4d6] p-6 text-black">
      <div className="flex items-start gap-3 border-b-2 border-black pb-4">
        <ShieldAlert className="mt-1 h-5 w-5 shrink-0" />
        <div>
          <h2 className="font-display text-2xl font-bold">Dean review: Consider results</h2>
          <p className="mt-1 font-mono text-xs leading-relaxed text-black/70">
            Provider report details are intentionally not copied into CampusConnect. Reviewers
            decide only whether the pending leadership transition may proceed, using the provider’s
            secure candidate/report workflow as needed.
          </p>
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 py-8 font-mono text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading review queue…
        </div>
      ) : records.length === 0 ? (
        <p className="py-8 font-mono text-sm">No Consider results are awaiting review.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {records.map((record) => {
            const club = first(record.clubs);
            const member = first(record.club_members);
            const profile = first(member?.profiles);
            return (
              <div key={record.id} className="neu-border bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="font-mono text-xs">
                    <p className="font-bold uppercase">{club?.name || "High-risk club"}</p>
                    <p className="mt-1">
                      Candidate: {profile?.full_name || "Club member"}{" "}
                      {profile?.email ? `(${profile.email})` : ""}
                    </p>
                    <p className="mt-1 text-black/60">
                      Completed{" "}
                      {record.completed_at
                        ? new Date(record.completed_at).toLocaleString()
                        : "recently"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === record.id}
                      onClick={() => void decide(record, "clear")}
                      className="neu-border inline-flex items-center gap-1 bg-lime px-3 py-2 font-mono text-xs font-bold disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" /> Approve role
                    </button>
                    <button
                      type="button"
                      disabled={busyId === record.id}
                      onClick={() => void decide(record, "failed")}
                      className="neu-border inline-flex items-center gap-1 bg-red-300 px-3 py-2 font-mono text-xs font-bold disabled:opacity-50"
                    >
                      <X className="h-4 w-4" /> Decline
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
