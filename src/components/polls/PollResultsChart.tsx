import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { PollResults } from "@/lib/pollUtils";

const BAR_COLORS = ["#000000", "#404040", "#808080", "#b0b0b0", "#d0d0d0", "#e8e8e8"];

interface PollResultsChartProps {
  results: PollResults[];
  userVote: string | null;
}

export function PollResultsChart({ results, userVote }: PollResultsChartProps) {
  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);

  const chartData = results.map((r) => ({
    name: r.text.length > 25 ? r.text.slice(0, 22) + "..." : r.text,
    fullName: r.text,
    votes: r.votes,
    optionId: r.optionId,
    percentage: totalVotes > 0 ? Math.round((r.votes / totalVotes) * 100) : 0,
  }));

  if (totalVotes === 0) {
    return (
      <div className="neu-border bg-cream p-6 text-center">
        <p className="font-mono text-sm text-black/50 italic">No votes yet</p>
      </div>
    );
  }

  return (
    <div className="neu-border bg-white p-4">
      <ResponsiveContainer width="100%" height={Math.max(120, results.length * 50)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fontSize: 12, fontFamily: "monospace", fill: "#000" }}
          />
          <Tooltip
            formatter={(value, _name, props) => {
              const p = props as { payload: { fullName: string; percentage: number } };
              return [
                `${value} vote${Number(value) !== 1 ? "s" : ""} (${p.payload.percentage}%)`,
                p.payload.fullName,
              ];
            }}
            contentStyle={{
              fontFamily: "monospace",
              fontSize: 12,
              border: "2px solid #000",
              borderRadius: 0,
              backgroundColor: "#fff",
            }}
          />
          <Bar dataKey="votes" radius={[0, 4, 4, 0]} barSize={24}>
            {chartData.map((entry, index) => (
              <Cell
                key={entry.optionId}
                fill={
                  entry.optionId === userVote ? "#000000" : BAR_COLORS[index % BAR_COLORS.length]
                }
                stroke={entry.optionId === userVote ? "#000" : "transparent"}
                strokeWidth={entry.optionId === userVote ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex items-center justify-between border-t-2 border-black pt-3">
        <span className="font-mono text-xs font-bold uppercase text-black/60">
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""} total
        </span>
        {userVote && (
          <span className="neu-border bg-black px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
            You voted
          </span>
        )}
      </div>
    </div>
  );
}
