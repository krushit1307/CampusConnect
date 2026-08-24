import { useState, useMemo } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { AlertTriangle, Users, Sparkles, Search, Shield, TrendingUp } from "lucide-react";

export interface SkillGapAxis {
  category: string;
  coverage: number;
  matching: number;
  required: number;
  sufficient: boolean;
  fullMark: number;
}

export interface SkillGapWarning {
  category: string;
  message: string;
  missing_keywords: string[];
  severity: "critical" | "warning";
}

export interface SkillGapData {
  club_id: string;
  board_size: number;
  total_unique_skills: number;
  skill_diversity: number;
  all_skills: string[];
  axes: SkillGapAxis[];
  warnings: SkillGapWarning[];
  health_score: number;
}

interface SkillGapAnalyzerProps {
  data: SkillGapData | null;
  isLoading: boolean;
  onSearchRecruit?: (keywords: string[]) => void;
  clubSlug?: string;
}

/**
 * Executive Board Skill Gap Analyzer
 * Displays a radar chart of board skill coverage, warnings about missing
 * competencies, and targeted recruitment suggestions.
 */
export function SkillGapAnalyzer({
  data,
  isLoading,
  onSearchRecruit,
  clubSlug,
}: SkillGapAnalyzerProps) {
  const [activeTab, setActiveTab] = useState<"chart" | "details">("chart");

  const chartData = useMemo(() => {
    if (!data?.axes) return [];
    return data.axes.map((a) => ({
      ...a,
      // Fill bars: only show coverage up to 100
      coverage: Math.min(a.coverage, 100),
      fullMark: 100,
    }));
  }, [data?.axes]);

  const healthColor = useMemo(() => {
    if (!data) return "#gray";
    if (data.health_score >= 80) return "#22c55e";
    if (data.health_score >= 50) return "#eab308";
    return "#ef4444";
  }, [data?.health_score]);

  const healthLabel = useMemo(() => {
    if (!data) return "Loading…";
    if (data.health_score >= 80) return "Strong";
    if (data.health_score >= 50) return "Moderate";
    return "Weak";
  }, [data?.health_score]);

  if (isLoading) {
    return (
      <div className="neu-border bg-white p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="font-mono text-sm text-gray-500 mt-3">Analyzing board skills…</p>
      </div>
    );
  }

  if (!data || data.board_size === 0) {
    return (
      <div className="neu-border bg-white p-8 text-center">
        <Users size={32} className="mx-auto text-gray-400 mb-3" />
        <p className="font-mono text-sm font-bold text-gray-600">No board members found</p>
        <p className="font-mono text-xs text-gray-400 mt-1">
          Add admin members with verified skills to see the analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="neu-border bg-white shadow-[6px_6px_0_0_#000]">
      {/* Header */}
      <div className="border-b-4 border-black p-4 bg-cream">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-purple-600" />
            <h3 className="font-display text-lg font-black uppercase">Board Skill Gap Analysis</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: healthColor }} />
            <span className="font-mono text-xs font-bold">
              {healthLabel} ({data.health_score}%)
            </span>
          </div>
        </div>
        <div className="flex gap-4 mt-2 font-mono text-[11px] text-gray-600">
          <span>
            <strong>{data.board_size}</strong> board members
          </span>
          <span>
            <strong>{data.total_unique_skills}</strong> unique skills
          </span>
          <span>
            <strong>{data.skill_diversity}</strong> diversity ratio
          </span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b-2 border-black">
        <button
          onClick={() => setActiveTab("chart")}
          className={`flex-1 px-4 py-2 font-mono text-xs font-bold uppercase transition-colors ${
            activeTab === "chart"
              ? "bg-black text-white"
              : "bg-white text-gray-500 hover:bg-gray-50"
          }`}
        >
          <TrendingUp size={12} className="inline mr-1" /> Radar Chart
        </button>
        <button
          onClick={() => setActiveTab("details")}
          className={`flex-1 px-4 py-2 font-mono text-xs font-bold uppercase transition-colors ${
            activeTab === "details"
              ? "bg-black text-white"
              : "bg-white text-gray-500 hover:bg-gray-50"
          }`}
        >
          <AlertTriangle size={12} className="inline mr-1" /> Warnings ({data.warnings.length})
        </button>
      </div>

      {/* Chart tab */}
      {activeTab === "chart" && (
        <div className="p-4">
          <div className="bg-gray-50 border border-gray-200 p-4">
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="category"
                  tick={{ fontSize: 11, fontWeight: "bold", fill: "#374151" }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: "#9ca3af" }}
                />
                <Radar
                  name="Coverage %"
                  dataKey="coverage"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.3}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "Coverage"]}
                  contentStyle={{
                    fontFamily: "monospace",
                    fontSize: "12px",
                    border: "2px solid black",
                  }}
                />
                <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: "11px" }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick coverage bars */}
          <div className="mt-4 space-y-2">
            {data.axes.map((axis) => (
              <div key={axis.category} className="flex items-center gap-2">
                <span className="w-24 font-mono text-[10px] font-bold text-right shrink-0">
                  {axis.category}
                </span>
                <div className="flex-1 h-4 bg-gray-100 border border-gray-300 relative">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${axis.coverage}%`,
                      backgroundColor: axis.sufficient ? "#22c55e" : "#ef4444",
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-bold">
                    {axis.matching}/{axis.required}+
                  </span>
                </div>
                <span className="w-10 font-mono text-[10px] text-right shrink-0">
                  {axis.coverage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings tab */}
      {activeTab === "details" && (
        <div className="p-4 space-y-3">
          {data.warnings.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles size={24} className="mx-auto text-green-500 mb-2" />
              <p className="font-mono text-sm font-bold text-green-700">
                Your board is well-balanced!
              </p>
              <p className="font-mono text-xs text-gray-500 mt-1">
                All critical skill categories are covered.
              </p>
            </div>
          ) : (
            data.warnings.map((warning) => (
              <div
                key={warning.category}
                className={`p-4 border-l-4 ${
                  warning.severity === "critical"
                    ? "border-red-500 bg-red-50"
                    : "border-yellow-500 bg-yellow-50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-sm font-bold text-gray-900">
                      {warning.severity === "critical" ? "🚨" : "⚠️"} {warning.category} — Missing
                    </p>
                    <p className="font-mono text-xs text-gray-600 mt-1">{warning.message}</p>
                  </div>
                </div>

                {/* Recruitment suggestion */}
                {onSearchRecruit && (
                  <button
                    onClick={() => onSearchRecruit(warning.missing_keywords)}
                    className="mt-3 flex items-center gap-1.5 bg-white border border-black px-3 py-1.5 font-mono text-[11px] font-bold uppercase hover:bg-lime transition-colors"
                  >
                    <Search size={12} />
                    Search for members with {warning.category.toLowerCase()} skills
                  </button>
                )}

                {!onSearchRecruit && clubSlug && (
                  <a
                    href={`/clubs/${clubSlug}/members?search=${warning.missing_keywords[0]}`}
                    className="mt-3 inline-flex items-center gap-1.5 bg-white border border-black px-3 py-1.5 font-mono text-[11px] font-bold uppercase hover:bg-lime transition-colors"
                  >
                    <Search size={12} />
                    Search members with {warning.category.toLowerCase()} skills
                  </a>
                )}
              </div>
            ))
          )}

          {/* Skills inventory */}
          {data.all_skills.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200">
              <p className="font-mono text-[10px] font-bold uppercase text-gray-500 mb-2">
                Board Skills Inventory
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.all_skills.map((skill) => (
                  <span
                    key={skill}
                    className="bg-white border border-gray-300 px-2 py-0.5 font-mono text-[10px]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
