import React, { useState, useEffect } from "react";
import {
  ClubSuccessionHealthService,
  SuccessionHealthReport,
  ExecutiveMember,
  SuccessorNomination,
} from "@/services/clubSuccessionHealthService";
import { NominateSuccessorModal } from "./NominateSuccessorModal";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Users,
  GraduationCap,
  Sparkles,
  UserPlus,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingDown,
} from "lucide-react";

interface ClubSuccessionHealthWidgetProps {
  clubId?: string;
  clubName?: string;
  currentUserId?: string;
}

export const ClubSuccessionHealthWidget: React.FC<ClubSuccessionHealthWidgetProps> = ({
  clubId = "club-cs-society-01",
  clubName = "Computer Science & Robotics Society",
  currentUserId = "user-pres-01",
}) => {
  const [report, setReport] = useState<SuccessionHealthReport | null>(null);
  const [nominations, setNominations] = useState<SuccessorNomination[]>([]);
  const [isNominateModalOpen, setIsNominateModalOpen] = useState(false);

  useEffect(() => {
    // Sample executive board scenario: 5 members, 4 Seniors graduating in current year (80%) and 0 underclassmen
    const currentYear = new Date().getFullYear();
    const sampleBoard: ExecutiveMember[] = [
      {
        userId: "u-1",
        name: "David Zhang",
        role: "President",
        expectedGraduationYear: currentYear,
        isGraduatingThisYear: true,
      },
      {
        userId: "u-2",
        name: "Elena Rostova",
        role: "Vice President",
        expectedGraduationYear: currentYear,
        isGraduatingThisYear: true,
      },
      {
        userId: "u-3",
        name: "Marcus Vance",
        role: "Treasurer",
        expectedGraduationYear: currentYear,
        isGraduatingThisYear: true,
      },
      {
        userId: "u-4",
        name: "Chloe Bennett",
        role: "Secretary",
        expectedGraduationYear: currentYear,
        isGraduatingThisYear: true,
      },
      {
        userId: "u-5",
        name: "Samira Khan",
        role: "Committee Lead",
        expectedGraduationYear: currentYear + 1,
        isGraduatingThisYear: false,
      },
    ];

    const rep = ClubSuccessionHealthService.evaluateSuccessionHealth({
      clubId,
      clubName,
      currentAcademicYear: currentYear,
      executives: sampleBoard,
      underclassmenPipelineCount: 0,
    });

    setReport(rep);
    setNominations(ClubSuccessionHealthService.getNominationsForClub(clubId));
  }, [clubId, clubName]);

  const handleNominationCreated = (nom: SuccessorNomination) => {
    setNominations((prev) => [nom, ...prev]);

    // Recalculate health with improved pipeline
    if (report) {
      const updatedRep = ClubSuccessionHealthService.evaluateSuccessionHealth({
        clubId,
        clubName,
        currentAcademicYear: report.currentAcademicYear,
        executives: report.executives,
        underclassmenPipelineCount: nominations.length + 1,
      });
      setReport(updatedRep);
    }
  };

  if (!report) return null;

  const isCritical = report.riskLevel === "CRITICAL_SUCCESSION_RISK";
  const isModerate = report.riskLevel === "MODERATE_RISK";

  return (
    <div className="w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 sm:p-7 shadow-lg space-y-6">
      {/* Widget Header & Health Gauge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Users className="w-3.5 h-3.5" />
            Club Continuity & Succession Health Monitor
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            {clubName}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Analyzes executive graduation years to prevent sudden organizational collapse.
          </p>
        </div>

        {/* Health Score Gauge Badge */}
        <div
          className={`flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-sm ${
            isCritical
              ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200"
              : isModerate
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-900"
                : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900"
          }`}
        >
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              Continuity Score
            </div>
            <div className="text-2xl font-black">{report.healthScore} / 100</div>
          </div>
          {isCritical ? (
            <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
          ) : (
            <ShieldCheck className="w-8 h-8 text-emerald-500" />
          )}
        </div>
      </div>

      {/* Prominent Warning Banner if at risk */}
      {report.warningNotice && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm font-medium flex items-start gap-3 ${
            isCritical
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200"
              : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
          <div className="space-y-1">
            <div className="font-bold text-sm">Action Required by Student Union:</div>
            <div>{report.warningNotice}</div>
          </div>
        </div>
      )}

      {/* Board Breakdown Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
          <div className="text-xs font-semibold text-slate-500">Graduating Executives</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {report.graduatingExecutivesCount} / {report.totalExecutives}{" "}
            <span className="text-xs text-rose-500 font-bold">
              ({report.graduatingRatioPercentage}%)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Graduating in {report.currentAcademicYear}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
          <div className="text-xs font-semibold text-slate-500">Underclassmen In Pipeline</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {report.underclassmenInPipeline} Leaders
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Freshmen / Sophomores in training</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
          <div className="text-xs font-semibold text-slate-500">Union Flag Status</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {report.flaggedToStudentUnion ? (
              <span className="text-red-500">🚩 High Risk Flag</span>
            ) : (
              <span className="text-emerald-500">Verified Clear</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Student Union Oversight</div>
        </div>
      </div>

      {/* Executives List & Current Nominations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Executive Roster */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-indigo-500" /> Current Executive Board
            </h4>
          </div>

          <div className="space-y-2">
            {report.executives.map((exec) => (
              <div
                key={exec.userId}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{exec.name}</div>
                  <div className="text-slate-500">{exec.role}</div>
                </div>

                <div className="text-right">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      exec.isGraduatingThisYear
                        ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    Class of '{String(exec.expectedGraduationYear).slice(-2)}'
                    {exec.isGraduatingThisYear ? " (Graduating)" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Plan & Nominate Successor Button */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-500" /> Recommended Action Plan
            </h4>

            <button
              onClick={() => setIsNominateModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" /> Nominate Trainee
            </button>
          </div>

          <div className="space-y-2">
            {report.recommendedActionPlan.map((action, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-950 dark:text-indigo-200"
              >
                <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                <span>{action}</span>
              </div>
            ))}

            {nominations.length > 0 && (
              <div className="pt-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Active Shadowing Trainees ({nominations.length}):
                </div>
                {nominations.map((nom) => (
                  <div
                    key={nom.id}
                    className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs flex justify-between items-center"
                  >
                    <div>
                      <span className="font-bold text-emerald-900 dark:text-emerald-200">
                        {nom.nomineeName}
                      </span>{" "}
                      <span className="text-slate-500">→ {nom.targetRole}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800">
                      Class of '{String(nom.expectedGraduationYear).slice(-2)}'
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nominate Modal */}
      <NominateSuccessorModal
        isOpen={isNominateModalOpen}
        onClose={() => setIsNominateModalOpen(false)}
        clubId={clubId}
        clubName={clubName}
        currentUserId={currentUserId}
        currentAcademicYear={report.currentAcademicYear}
        onNominationCreated={handleNominationCreated}
      />
    </div>
  );
};
