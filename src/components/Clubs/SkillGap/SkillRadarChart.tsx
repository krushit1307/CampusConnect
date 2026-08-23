import React, { useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  SkillCount,
  HeuristicMatrix,
  DEFAULT_HEURISTIC_MATRIX,
} from "@/services/clubSkillGapService";

interface SkillRadarChartProps {
  currentSkills: SkillCount[];
  heuristic?: HeuristicMatrix;
}

export function SkillRadarChart({
  currentSkills,
  heuristic = DEFAULT_HEURISTIC_MATRIX,
}: SkillRadarChartProps) {
  const chartData = useMemo(() => {
    // Collect all unique skills between current and heuristic
    const allSkills = new Set<string>();

    currentSkills.forEach((sc) => allSkills.add(sc.skill));
    Object.keys(heuristic).forEach((s) => allSkills.add(s));

    // Map to recharts data format
    const currentMap = new Map<string, number>();
    currentSkills.forEach((sc) => {
      currentMap.set(sc.skill.toLowerCase(), sc.count);
    });

    return Array.from(allSkills).map((skillName) => {
      const normalized = skillName.toLowerCase();
      const current = currentMap.get(normalized) ?? 0;
      const target =
        heuristic[skillName] ??
        heuristic[Object.keys(heuristic).find((k) => k.toLowerCase() === normalized) ?? ""] ??
        0;

      return {
        subject: skillName,
        current: current,
        target: target,
        fullMark: Math.max(target, current, 3), // Give minimum radius scale
      };
    });
  }, [currentSkills, heuristic]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50 border-2 border-black border-dashed">
        <p className="font-mono text-xs text-gray-500">No skills to display.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-80 pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="#e5e7eb" strokeDasharray="3 3" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#374151", fontSize: 11, fontFamily: "monospace", fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, "dataMax"]}
            tick={{ fill: "#6b7280", fontSize: 10 }}
          />
          <Radar
            name="Current Team Skills"
            dataKey="current"
            stroke="#8b5cf6"
            fill="#8b5cf6"
            fillOpacity={0.5}
            strokeWidth={2}
          />
          <Radar
            name="Healthy Target"
            dataKey="target"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.2}
            strokeWidth={2}
            strokeDasharray="4 4"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "2px solid #000",
              boxShadow: "3px 3px 0 #000",
              fontFamily: "monospace",
              fontSize: "12px",
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
