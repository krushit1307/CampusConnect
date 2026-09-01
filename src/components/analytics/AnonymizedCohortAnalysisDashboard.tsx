import React, { useState } from "react";
import {
  ShieldCheck,
  UserX,
  Search,
  Database,
  BarChart3,
  CheckCircle2,
  Lock,
  GraduationCap,
  Calendar,
  Sparkles,
  Users,
} from "lucide-react";
import {
  CohortAnonymizationResult,
  CohortEventAttendanceQuery,
  generateCohortHash,
  anonymizeUserCohortData,
  queryCohortEventAttendance,
} from "@/lib/anonymizedCohortAnalysis";
import { cn } from "@/lib/utils";

export interface AnonymizedCohortAnalysisDashboardProps {
  initialMajor?: string;
  initialGradYear?: number;
  onAnonymizationCompleted?: (result: CohortAnonymizationResult) => void;
  className?: string;
}

export const AnonymizedCohortAnalysisDashboard: React.FC<AnonymizedCohortAnalysisDashboardProps> = ({
  initialMajor = "Computer Science",
  initialGradYear = 2024,
  onAnonymizationCompleted,
  className,
}) => {
  const [major, setMajor] = useState<string>(initialMajor);
  const [gradYear, setGradYear] = useState<number>(initialGradYear);
  const [queryResult, setQueryResult] = useState<CohortEventAttendanceQuery | null>(() =>
    queryCohortEventAttendance(initialMajor, initialGradYear, "Annual Campus Hackathon 2024", 48)
  );

  const [anonymizationResult, setAnonymizationResult] = useState<CohortAnonymizationResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleRunCohortQuery = (e: React.FormEvent) => {
    e.preventDefault();
    const res = queryCohortEventAttendance(major, gradYear, "Annual Campus Hackathon 2024", 48);
    setQueryResult(res);
  };

  const handleSimulateUserDeletion = () => {
    const result = anonymizeUserCohortData("u-inactive-9901", major, gradYear, [
      "evt-hackathon-2024",
      "evt-tech-fair-2024",
      "evt-ai-workshop-2024",
    ]);

    setAnonymizationResult(result);
    if (onAnonymizationCompleted) onAnonymizationCompleted(result);

    setNotice(
      `User PII purged successfully! 3 historical RSVPs re-parented to ${result.cohortHash}.`
    );
    setTimeout(() => setNotice(null), 6000);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-teal-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-teal-950">
            <ShieldCheck className="w-5 h-5 text-teal-700 animate-pulse" />
            <span>Automated "Data Privacy" Anonymized Cohort Analysis</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Cryptographic Cohort Hashing re-parenting user RSVPs to generic cohort IDs before PII destruction. Preserves longitudinal academic research.
          </p>
        </div>

        <span className="px-3 py-1 bg-black text-white font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
          <Lock className="w-3.5 h-3.5 text-teal-300" />
          <span>PII Wiped • Research Retained</span>
        </span>
      </div>

      {/* Confirmation Notification Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Grid: Cohort Query Explorer & Anonymization Simulator */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left Column: University Cohort Research Query */}
        <form onSubmit={handleRunCohortQuery} className="p-5 border-b-2 md:border-b-0 md:border-r-2 border-black space-y-4 bg-white">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Search className="w-4 h-4 text-teal-600" />
            Longitudinal Cohort Research Explorer
          </h4>

          <div className="space-y-3">
            <div>
              <label htmlFor="major-input" className="text-xs font-bold uppercase block text-gray-700">
                Academic Major *
              </label>
              <input
                id="major-input"
                type="text"
                required
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-mono font-bold bg-white mt-1"
              />
            </div>

            <div>
              <label htmlFor="grad-year-input" className="text-xs font-bold uppercase block text-gray-700">
                Graduation Year *
              </label>
              <input
                id="grad-year-input"
                type="number"
                required
                value={gradYear}
                onChange={(e) => setGradYear(Number(e.target.value))}
                className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-mono font-bold bg-white mt-1"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 border-2 border-black bg-teal-600 text-white font-bold text-xs uppercase rounded-md hover:bg-teal-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Query Anonymized Cohort Analytics
          </button>

          {/* Query Output Card */}
          {queryResult && (
            <div className="p-3.5 border-2 border-black rounded-lg bg-teal-50 space-y-2 text-xs font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center text-teal-950 font-bold border-b border-teal-200 pb-1.5 text-[11px]">
                <span>{generateCohortHash(queryResult.major, queryResult.graduationYear)}</span>
                <span className="text-teal-700">ANONYMIZED</span>
              </div>

              <div className="space-y-1 text-[11px] text-teal-900">
                <p>Event Analyzed: <span className="font-bold text-black">{queryResult.eventName}</span></p>
                <p>Total Attended: <span className="font-black text-teal-700 text-base">{queryResult.totalAttendedCount} Students</span></p>
                <p className="text-[10px] text-gray-600 font-sans">
                  🔒 Zero individual student PII stored or exposed.
                </p>
              </div>
            </div>
          )}
        </form>

        {/* Right Column: User Purge & Cohort Re-parenting Simulator */}
        <div className="p-5 bg-slate-50 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <UserX className="w-4 h-4 text-rose-600" />
            User Purge & Cohort Hashing Simulator
          </h4>

          <p className="text-xs font-sans text-gray-700">
            Simulate inactivating a user account. Extracts major & graduation year, re-parents event RSVPs to generic cohort ID, and executes PII destruction.
          </p>

          <button
            type="button"
            onClick={handleSimulateUserDeletion}
            className="w-full py-3 px-4 border-2 border-black bg-rose-600 text-white font-bold text-xs uppercase rounded-md hover:bg-rose-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
          >
            <UserX className="w-4 h-4 text-amber-300" />
            Anonymize & Purge User PII
          </button>

          {/* Anonymization Result Banner */}
          {anonymizationResult && (
            <div className="p-3.5 border-2 border-black rounded-lg bg-slate-900 text-white space-y-2 font-mono text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center text-[10px] text-teal-400 font-bold border-b border-slate-700 pb-1.5">
                <span className="flex items-center gap-1">
                  <Database className="w-3.5 h-3.5" /> COHORT RE-PARENTING AUDIT
                </span>
                <span>STATUS: PURGED</span>
              </div>

              <div className="space-y-1 text-[11px] text-gray-300">
                <p>Target Cohort: <span className="text-white font-bold">{anonymizationResult.cohortHash}</span></p>
                <p>RSVPs Re-parented: <span className="text-teal-400 font-bold">{anonymizationResult.reparentedRsvpsCount} Events</span></p>
                <p>User PII Status: <span className="text-rose-400 font-bold">WIPED / DELETED</span></p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
