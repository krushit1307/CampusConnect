import React, { useState } from "react";
import {
  ClubSuccessionHealthService,
  SuccessorNomination,
} from "@/services/clubSuccessionHealthService";
import { UserPlus, GraduationCap, Award, X, AlertCircle } from "lucide-react";

interface NominateSuccessorModalProps {
  isOpen: boolean;
  onClose: () => void;
  clubId: string;
  clubName: string;
  currentUserId: string;
  currentAcademicYear: number;
  onNominationCreated: (nomination: SuccessorNomination) => void;
}

export const NominateSuccessorModal: React.FC<NominateSuccessorModalProps> = ({
  isOpen,
  onClose,
  clubId,
  clubName,
  currentUserId,
  currentAcademicYear,
  onNominationCreated,
}) => {
  const [nomineeName, setNomineeName] = useState("");
  const [nomineeUserId, setNomineeUserId] = useState("user-student-nominee");
  const [targetRole, setTargetRole] = useState("Officer-in-Training (President Track)");
  const [expectedGradYear, setExpectedGradYear] = useState(currentAcademicYear + 2); // Sophomore/Freshman
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomineeName.trim()) {
      setError("Please provide a nominee name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const nomination = ClubSuccessionHealthService.nominateSuccessor({
        clubId,
        nomineeUserId,
        nomineeName,
        targetRole,
        expectedGraduationYear: Number(expectedGradYear),
        nominatedByUserId: currentUserId,
      });

      onNominationCreated(nomination);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to nominate successor");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Nominate Successor / Trainee
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{clubName}</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Nominee Name (Underclassman)
            </label>
            <input
              type="text"
              value={nomineeName}
              onChange={(e) => setNomineeName(e.target.value)}
              placeholder="e.g. Jordan Miller (Class of '28)"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Target Track / Position
            </label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold"
            >
              <option value="Officer-in-Training (President Track)">
                Officer-in-Training (President Track)
              </option>
              <option value="Deputy Vice President">Deputy Vice President</option>
              <option value="Associate Treasurer (Finance Trainee)">
                Associate Treasurer (Finance Trainee)
              </option>
              <option value="Committee Lead (Events & Marketing)">
                Committee Lead (Events & Marketing)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-indigo-500" />
              Expected Graduation Year
            </label>
            <input
              type="number"
              min={currentAcademicYear + 1}
              max={currentAcademicYear + 5}
              value={expectedGradYear}
              onChange={(e) => setExpectedGradYear(Number(e.target.value))}
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md transition-all"
            >
              {isSubmitting ? "Nominating..." : "Submit Nomination"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
