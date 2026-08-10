import { useActivePoll } from "@/hooks/useActivePoll";
import { PollResultsChart } from "@/components/polls/PollResultsChart";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BarChart3, Check } from "lucide-react";

interface ActivePollProps {
  eventId: string;
  userId: string | undefined;
}

export function ActivePoll({ eventId, userId }: ActivePollProps) {
  const { activePoll, results, userVote, isLoading, isVoting, vote } = useActivePoll(
    eventId,
    userId,
  );

  if (isLoading) {
    return (
      <div className="neu-border bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
          <span className="font-mono text-sm text-black/60">Loading poll...</span>
        </div>
      </div>
    );
  }

  if (!activePoll) return null;

  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);

  return (
    <div className="neu-border bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-blue-900" />
        <h3 className="font-display text-lg font-bold uppercase tracking-tight text-blue-900">
          Live Poll
        </h3>
        <span className="neu-border bg-lime px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
          Active
        </span>
      </div>

      <p className="mb-6 font-mono text-sm font-bold text-black">{activePoll.question}</p>

      {userVote ? (
        <PollResultsChart results={results} userVote={userVote} />
      ) : (
        <div className="space-y-3">
          {results.map((r, index) => (
            <button
              key={r.optionId}
              disabled={isVoting}
              onClick={async () => {
                if (!userId) {
                  toast.error("Please log in to vote");
                  return;
                }
                try {
                  await vote(r.optionId);
                } catch {
                  toast.error("Failed to cast vote. Please try again.");
                }
              }}
              className="neu-border neu-press flex w-full items-center gap-3 bg-white p-4 text-left font-mono text-sm font-bold uppercase transition-all duration-200 hover:bg-cream disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-black bg-cream text-xs font-bold">
                {String.fromCharCode(65 + index)}
              </span>
              {r.text}
            </button>
          ))}

          <p className="pt-2 text-center font-mono text-xs text-black/40">
            {totalVotes} vote{totalVotes !== 1 ? "s" : ""} cast so far
          </p>
        </div>
      )}
    </div>
  );
}
