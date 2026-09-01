import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { SurveyQuestion, SurveyResponse } from "@/hooks/useEventSurveyBuilder";

interface SurveyResultsViewProps {
  questions: SurveyQuestion[];
  responses: SurveyResponse[];
  responseCount: number;
}

const COLORS = [
  "#a3e635",
  "#60a5fa",
  "#facc15",
  "#f87171",
  "#c084fc",
  "#34d399",
  "#fb923c",
  "#a78bfa",
];

function computeStats(questionId: string, type: string, responses: SurveyResponse[]) {
  const relevant = responses.filter((r) => r.questionId === questionId);
  if (relevant.length === 0) return null;

  switch (type) {
    case "rating":
    case "scale": {
      const nums = relevant.map((r) => Number(r.answer));
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      const dist: Record<string, number> = {};
      for (const n of nums) dist[String(n)] = (dist[String(n)] || 0) + 1;
      const chartData = Object.entries(dist).map(([name, value]) => ({ name, value }));
      return {
        total: relevant.length,
        average: Math.round(avg * 10) / 10,
        chartData,
        type: "bar" as const,
      };
    }
    case "yes_no": {
      const counts = { Yes: 0, No: 0 };
      for (const r of relevant) counts[r.answer as "Yes" | "No"]++;
      const chartData = Object.entries(counts).map(([name, value]) => ({ name, value }));
      return {
        total: relevant.length,
        yesPercent: Math.round((counts.Yes / relevant.length) * 100),
        chartData,
        type: "pie" as const,
      };
    }
    case "multiple_choice": {
      const counts: Record<string, number> = {};
      for (const r of relevant) counts[r.answer as string] = (counts[r.answer as string] || 0) + 1;
      const chartData = Object.entries(counts).map(([name, value]) => ({ name, value }));
      return { total: relevant.length, chartData, type: "pie" as const };
    }
    case "text": {
      return {
        total: relevant.length,
        samples: relevant
          .slice(0, 8)
          .map((r) => ({ text: String(r.answer), author: r.respondentName || "Anonymous" })),
        type: "text" as const,
      };
    }
    default:
      return null;
  }
}

function RatingStat({
  question,
  stats,
}: {
  question: SurveyQuestion;
  stats: NonNullable<ReturnType<typeof computeStats>> & { type: "bar" };
}) {
  const maxVal = question.type === "scale" ? question.max || 10 : 5;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <span className="font-display text-4xl font-black text-black">{stats.average}</span>
        <div>
          <span className="font-mono text-[10px] font-bold text-gray-500">/ {maxVal}</span>
          <p className="font-mono text-[10px] text-gray-400">{stats.total} responses</p>
        </div>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#000" strokeOpacity={0.1} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "monospace" }} />
            <YAxis tick={{ fontSize: 10, fontFamily: "monospace" }} allowDecimals={false} />
            <Tooltip />
            <Bar
              dataKey="value"
              fill="#a3e635"
              stroke="#000"
              strokeWidth={1}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function YesNoStat({
  stats,
}: {
  stats: NonNullable<ReturnType<typeof computeStats>> & { type: "pie" };
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <span className="font-display text-4xl font-black text-green-600">{stats.yesPercent}%</span>
        <span className="font-mono text-xs text-gray-500">Yes rate · {stats.total} responses</span>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={stats.chartData}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={60}
              paddingAngle={4}
              dataKey="value"
            >
              {stats.chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === 0 ? "#a3e635" : "#f87171"}
                  stroke="#000"
                  strokeWidth={1}
                />
              ))}
            </Pie>
            <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "monospace", fontWeight: 700 }} />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MultipleChoiceStat({
  stats,
}: {
  stats: NonNullable<ReturnType<typeof computeStats>> & { type: "pie" };
}) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-gray-500">{stats.total} responses</p>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={stats.chartData}
              cx="50%"
              cy="50%"
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {stats.chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#000" strokeWidth={1} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TextStat({
  stats,
}: {
  stats: NonNullable<ReturnType<typeof computeStats>> & { type: "text" };
}) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-xs text-gray-500">{stats.total} responses</p>
      <div className="space-y-2">
        {stats.samples.map((s, i) => (
          <div key={i} className="neu-border bg-gray-50 p-3">
            <p className="font-display text-sm text-black italic">"{s.text}"</p>
            <p className="font-mono text-[10px] text-gray-400 mt-1">— {s.author}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SurveyResultsView({ questions, responses, responseCount }: SurveyResultsViewProps) {
  if (responses.length === 0) {
    return (
      <div className="neu-border bg-white p-12 text-center shadow-[2px_2px_0_0_#000]">
        <p className="font-display text-xl font-black text-gray-400">No responses yet</p>
        <p className="font-mono text-sm text-gray-400 mt-2">
          Share your survey to start collecting feedback
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="neu-border bg-white p-4 shadow-[2px_2px_0_0_#000] flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-sm">Results Overview</h3>
          <p className="font-mono text-[10px] text-gray-500">
            {responseCount} unique respondents · {questions.length} questions
          </p>
        </div>
        <div className="neu-border bg-lime px-3 py-1 font-mono text-xs font-bold">
          {responses.length} total answers
        </div>
      </div>

      {questions.map((q, i) => {
        const stats = computeStats(q.id, q.type, responses);
        if (!stats) return null;

        return (
          <div key={q.id} className="neu-border bg-white p-5 shadow-[2px_2px_0_0_#000]">
            <div className="flex items-start gap-3 mb-4">
              <span className="neu-border bg-sky w-7 h-7 flex items-center justify-center font-mono text-xs font-black shrink-0">
                {i + 1}
              </span>
              <div>
                <h4 className="font-display font-bold text-sm">{q.title}</h4>
                {q.description && (
                  <p className="font-mono text-[10px] text-gray-500">{q.description}</p>
                )}
              </div>
            </div>

            {stats.type === "bar" && <RatingStat question={q} stats={stats} />}
            {stats.type === "pie" && q.type === "yes_no" && <YesNoStat stats={stats} />}
            {stats.type === "pie" && q.type === "multiple_choice" && (
              <MultipleChoiceStat stats={stats} />
            )}
            {stats.type === "text" && <TextStat stats={stats} />}
          </div>
        );
      })}
    </div>
  );
}
