import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, FileText, Video, Lock } from "lucide-react";
import {
  type Election,
  type Candidate,
  type MyVote,
  getCandidates,
  getMyVote,
  castVote,
  getManifestoUrl,
} from "@/lib/supabase/elections";

export type ElectionBallotProps = {
  election: Election;
  /** Called after a vote is successfully cast, so the parent can refresh state. */
  onVoted?: () => void;
};

/**
 * The voting screen for a single election. Deliberately never fetches or
 * displays vote counts — that's not this component's job at all, and the
 * `election_results` view wouldn't return anything useful before the
 * election closes anyway. This only ever shows: the ballot, and whether
 * *this* member has already voted.
 */
export function ElectionBallot({ election, onVoted }: ElectionBallotProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [myVote, setMyVote] = useState<MyVote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [manifestoUrls, setManifestoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [candidatesResult, voteResult] = await Promise.all([
        getCandidates(election.id),
        getMyVote(election.id),
      ]);
      if (cancelled) return;

      if (candidatesResult.error) {
        toast.error("Couldn't load candidates.");
      } else {
        setCandidates(candidatesResult.data ?? []);
      }

      if (!voteResult.error) {
        setMyVote(voteResult.data);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [election.id]);

  const handleViewManifesto = async (candidate: Candidate) => {
    if (!candidate.manifesto_path) return;
    if (manifestoUrls[candidate.id]) {
      window.open(manifestoUrls[candidate.id], "_blank", "noopener,noreferrer");
      return;
    }
    const { data: url, error } = await getManifestoUrl(candidate.manifesto_path);
    if (error || !url) {
      toast.error("Couldn't load that manifesto right now.");
      return;
    }
    setManifestoUrls((prev) => ({ ...prev, [candidate.id]: url }));
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleVote = async (candidateId: string) => {
    setSubmittingId(candidateId);
    const { error } = await castVote(election.id, candidateId);
    setSubmittingId(null);

    if (error) {
      toast.error("That vote didn't go through. You may have already voted, or voting may have closed.");
      return;
    }

    setMyVote({ election_id: election.id, candidate_id: candidateId });
    toast.success("Your vote is in. Results stay hidden until the election closes.");
    onVoted?.();
  };

  if (election.status !== "open") {
    return (
      <div className="neu-border flex flex-col items-center gap-2 bg-cream p-8 text-center dark:bg-zinc-900">
        <Lock size={28} aria-hidden="true" />
        <p className="font-mono text-sm font-bold uppercase">
          {election.status === "draft" ? "Voting hasn't opened yet." : "Voting has closed."}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="neu-border bg-white p-8 text-center font-mono text-sm dark:bg-zinc-900">
        Loading ballot…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="neu-border flex items-center gap-2 bg-sky p-3 font-mono text-xs uppercase dark:text-black">
        <Clock size={14} aria-hidden="true" />
        Results are hidden from everyone, including club admins, until voting closes.
      </div>

      {myVote && (
        <div className="neu-border flex items-center gap-2 bg-lime p-3 font-mono text-xs font-bold uppercase dark:text-black">
          <CheckCircle2 size={14} aria-hidden="true" />
          You've cast your vote. It can't be changed.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {candidates.map((candidate) => {
          const isMyPick = myVote?.candidate_id === candidate.id;
          return (
            <div
              key={candidate.id}
              className={`neu-border flex flex-col gap-3 bg-white p-4 dark:bg-zinc-900 ${
                isMyPick ? "ring-4 ring-lime" : ""
              }`}
            >
              <div>
                <h3 className="font-mono text-base font-bold">{candidate.name}</h3>
                {candidate.bio && (
                  <p className="mt-1 font-mono text-sm text-gray-600 dark:text-zinc-400">
                    {candidate.bio}
                  </p>
                )}
              </div>

              {candidate.manifesto_path && (
                <button
                  type="button"
                  onClick={() => handleViewManifesto(candidate)}
                  className="neu-border flex w-fit items-center gap-1.5 bg-peach px-3 py-1.5 font-mono text-xs font-bold uppercase transition hover:-translate-y-0.5 dark:text-black"
                >
                  {candidate.manifesto_type === "video" ? (
                    <Video size={14} aria-hidden="true" />
                  ) : (
                    <FileText size={14} aria-hidden="true" />
                  )}
                  View platform
                </button>
              )}

              <Button
                type="button"
                variant={isMyPick ? "outline" : "primary"}
                disabled={Boolean(myVote) || submittingId !== null}
                onClick={() => handleVote(candidate.id)}
              >
                {isMyPick
                  ? "Your vote"
                  : submittingId === candidate.id
                    ? "Casting vote…"
                    : "Vote for this candidate"}
              </Button>
            </div>
          );
        })}
      </div>

      {candidates.length === 0 && (
        <p className="neu-border bg-white p-6 text-center font-mono text-sm dark:bg-zinc-900">
          No candidates have been added yet.
        </p>
      )}
    </div>
  );
}
