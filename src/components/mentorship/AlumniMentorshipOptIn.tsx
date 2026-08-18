import React, { useState } from "react";
import { UserCheck, ShieldCheck, HeartHandshake, CheckCircle2 } from "lucide-react";
import { useExecutiveMentorship } from "@/hooks/useExecutiveMentorship";

interface AlumniMentorshipOptInProps {
  userId: string;
  className?: string;
}

export const AlumniMentorshipOptIn: React.FC<AlumniMentorshipOptInProps> = ({
  userId,
  className = "",
}) => {
  const { profile, updateOptIn } = useExecutiveMentorship(userId);
  const [saving, setSaving] = useState(false);
  const isOptedIn = profile?.is_opted_in ?? false;

  const handleToggle = async () => {
    setSaving(true);
    try {
      await updateOptIn(!isOptedIn);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`p-5 bg-gradient-to-br from-indigo-50/70 to-purple-50/70 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-4 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-lg shadow-sm">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              Alumni Leadership Mentorship Program
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
              Guide the next generation of club presidents, treasurers, and executive officers.
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={saving}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all shadow-sm ${
            isOptedIn
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-indigo-600 hover:bg-indigo-700 text-white"
          }`}
        >
          {saving
            ? "Saving..."
            : isOptedIn
            ? "Opted In as Mentor"
            : "Opt-In as Mentor"}
        </button>
      </div>

      {isOptedIn && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span>
            Thank you for participating! You will be automatically matched with incoming leaders of similar student organizations.
          </span>
        </div>
      )}
    </div>
  );
};
