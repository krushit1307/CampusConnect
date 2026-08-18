import React, { useState } from "react";
import {
  Award,
  Download,
  FileText,
  Loader2,
  Sparkles,
  TrendingUp,
  DollarSign,
  Users,
} from "lucide-react";
import { clubReportCardService, ClubReportCard } from "@/services/clubReportCardService";

interface ClubReportCardGeneratorProps {
  clubId: string;
  clubName: string;
}

export const ClubReportCardGenerator: React.FC<ClubReportCardGeneratorProps> = ({
  clubId,
  clubName,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ClubReportCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await clubReportCardService.generateReportCard(clubId, selectedYear);
      if (data?.report_card) {
        setReport(data.report_card);
      }
    } catch (err) {
      setError((err as Error).message || "Failed to generate report card.");
    } finally {
      setLoading(false);
    }
  };

  const getGradeBadgeColor = (grade: string) => {
    switch (grade) {
      case "A":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300";
      case "B":
        return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300";
      case "C":
        return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300";
      case "D":
        return "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300";
      default:
        return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300";
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Club Performance Report Card
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Automated Annual Audit Report Card & Metric Rubric for {clubName}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 rounded-lg px-3 py-1.5 text-sm text-neutral-800 dark:text-neutral-200"
          >
            <option value={2026}>2026 Academic Year</option>
            <option value={2025}>2025 Academic Year</option>
            <option value={2024}>2024 Academic Year</option>
          </select>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Aggregating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Audit
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-sm rounded-lg">
          {error}
        </div>
      )}

      {report && (
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Audited Performance Grade
              </span>
              <div className="flex items-center gap-3 mt-1">
                <span
                  className={`text-3xl font-extrabold px-3.5 py-0.5 rounded-lg border ${getGradeBadgeColor(
                    report.computed_grade,
                  )}`}
                >
                  {report.computed_grade}
                </span>
                <span className="text-sm text-neutral-600 dark:text-neutral-400 font-medium">
                  Overall Rubric Score: {report.rubric_breakdown.totalScore}/100
                </span>
              </div>
            </div>

            <button
              onClick={() => clubReportCardService.downloadMockPdf(report, clubName)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Audit PDF
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                Total Events
              </div>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">
                {report.total_events}
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                Avg. Attendance
              </div>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">
                {report.avg_attendance}
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                Budget Spent
              </div>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">
                ${(report.total_budget_spent_cents / 100).toFixed(0)}
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                Member Churn
              </div>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">
                {report.member_churn_rate}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
