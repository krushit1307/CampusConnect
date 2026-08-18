import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { Lock, Trophy } from "lucide-react";
import { type Election, type ElectionResultRow, getElectionResults } from "@/lib/supabase/elections";

export type ElectionResultsProps = {
  election: Election;
};

const BAR_COLORS = ["#a3e635", "#7dd3fc", "#fdba74", "#f0abfc", "#fca5a5", "#fde047"];

/**
 * Shows aggregate results for a closed election. This component never
 * decides on its own whether results are "allowed" to be shown — it just
 * displays whatever `election_results` returns, which is structurally
 * empty until the election is actually closed and its end_time has
 * passed (see the view's definition in the migration). There's no
 * client-side date check to bypass here, by design.
 */
export function ElectionResults({ election }: ElectionResultsProps) {
  const [results, setResults] = useState<ElectionResultRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await getElectionResults(election.id);
      if (cancelled) return;
      if (error) toast.error("Couldn't load results.");
      setResults(data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [election.id]);

  if (loading) {
    return (
      <div className="neu-border bg-white p-8 text-center font-mono text-sm dark:bg-zinc-900">
        Loading…
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="neu-border flex flex-col items-center gap-2 bg-cream p-8 text-center dark:bg-zinc-900">
        <Lock size={28} aria-hidden="true" />
        <p className="font-mono text-sm font-bold uppercase">
          {election.status === "closed"
            ? "No votes were cast."
            : "Results are hidden until the election closes."}
        </p>
        {election.status === "open" && (
          <p className="font-mono text-xs text-gray-600 dark:text-zinc-400">
            Closes {new Date(election.end_time).toLocaleString()}
          </p>
        )}
      </div>
    );
  }

  const sorted = [...results].sort((a, b) => b.vote_count - a.vote_count);
  const topCount = sorted[0]?.vote_count ?? 0;
  const winners = sorted.filter((r) => r.vote_count === topCount);
  const totalVotes = sorted.reduce((sum, r) => sum + r.vote_count, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="neu-border flex items-center gap-2 bg-lime p-3 font-mono text-xs font-bold uppercase dark:text-black">
        <Trophy size={14} aria-hidden="true" />
        {winners.length > 1
          ? `Tie between ${winners.map((w) => w.candidate_name).join(" and ")}`
          : `${winners[0].candidate_name} won with ${topCount} vote${topCount === 1 ? "" : "s"}`}
        {election.tie_extension_count > 0 && " (after a runoff extension)"}
      </div>

      <div className="neu-border bg-white p-4 dark:bg-zinc-900">
        <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 56)}>
          <BarChart data={sorted} layout="vertical" margin={{ left: 24, right: 24 }}>
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="candidate_name" width={140} tick={{ fontSize: 12 }} />
            <Bar dataKey="vote_count" radius={[0, 4, 4, 0]}>
              {sorted.map((entry, index) => (
                <Cell key={entry.candidate_id} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-center font-mono text-xs text-gray-500 dark:text-zinc-400">
        {totalVotes} total vote{totalVotes === 1 ? "" : "s"} cast
      </p>
    </div>
  );
}
