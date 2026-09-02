import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ClubSkillGapService,
  SkillCount,
  HeuristicMatrix,
  DEFAULT_HEURISTIC_MATRIX,
} from "@/services/clubSkillGapService";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Search from "lucide-react/dist/esm/icons/search";
import Info from "lucide-react/dist/esm/icons/info";

interface SkillGapSuggestionsProps {
  clubId: string;
  currentSkills: SkillCount[];
  heuristic?: HeuristicMatrix;
}

export function SkillGapSuggestions({
  clubId,
  currentSkills,
  heuristic = DEFAULT_HEURISTIC_MATRIX,
}: SkillGapSuggestionsProps) {
  const gaps = useMemo(() => {
    return ClubSkillGapService.calculateGaps(currentSkills, heuristic);
  }, [currentSkills, heuristic]);

  if (gaps.length === 0) {
    return (
      <div className="bg-lime p-5 border-2 border-black shadow-[4px_4px_0_0_#000] dark:bg-lime/20 dark:border-white">
        <div className="flex items-start gap-4">
          <div className="bg-white p-2 border-2 border-black rounded-full">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h4 className="font-display font-black text-lg text-black dark:text-white uppercase tracking-wide">
              Healthy Leadership Board
            </h4>
            <p className="font-mono text-sm text-gray-800 dark:text-gray-200 mt-1">
              Your executive board meets all recommended 'Healthy Board' requirements. Great job!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 p-5 border-2 border-orange-600 shadow-[4px_4px_0_0_#ea580c] dark:bg-orange-950/30">
        <div className="flex items-start gap-4">
          <div className="bg-white p-2 border-2 border-orange-600 rounded-full">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h4 className="font-display font-black text-lg text-orange-900 dark:text-orange-300 uppercase tracking-wide">
              Skill Gaps Detected
            </h4>
            <p className="font-mono text-sm text-orange-800 dark:text-orange-400 mt-1">
              Your leadership team lacks critical competencies. This often results in operational
              bottlenecks. Consider recruiting to fill these gaps.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {gaps.map((gap, index) => (
          <div
            key={index}
            className="group flex flex-col justify-between bg-white border-2 border-black p-4 shadow-[4px_4px_0_0_#000] hover:shadow-[6px_6px_0_0_#000] transition-all dark:bg-zinc-900 dark:border-white"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-display font-black text-base uppercase">{gap.skill}</span>
                <span className="bg-red-100 text-red-800 font-mono text-[10px] font-bold px-2 py-0.5 border border-red-800 uppercase tracking-widest">
                  Missing
                </span>
              </div>
              <p className="font-mono text-xs text-gray-600 mt-2 mb-4 dark:text-gray-400">
                You have {gap.current} of the recommended {gap.required} active members with this
                skill.
              </p>
            </div>

            <Link
              to={`/directory?skill=${encodeURIComponent(gap.skill)}`}
              className="mt-auto flex items-center justify-center gap-2 bg-black text-white font-mono text-xs font-bold uppercase py-2 px-4 border-2 border-transparent group-hover:bg-brand-blue-base group-hover:border-black transition-colors"
            >
              <Search className="h-4 w-4" />
              Recruit {gap.skill} Talent
            </Link>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-blue-50 text-blue-800 border border-blue-200 p-3 text-xs font-mono dark:bg-blue-900/30 dark:border-blue-900 dark:text-blue-300">
        <Info className="h-4 w-4 flex-shrink-0" />
        <p>
          Recruiting members with these verified skills ensures operational efficiency and a
          well-rounded board.
        </p>
      </div>
    </div>
  );
}
