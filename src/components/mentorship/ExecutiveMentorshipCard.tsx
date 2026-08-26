import React from "react";
import { MessageSquare, Award, Clock, ArrowRight } from "lucide-react";
import { MentorshipMatch } from "@/hooks/useExecutiveMentorship";

interface ExecutiveMentorshipCardProps {
  match: MentorshipMatch;
  clubName?: string;
  onOpenChat?: (channelId: string) => void;
  className?: string;
}

export const ExecutiveMentorshipCard: React.FC<ExecutiveMentorshipCardProps> = ({
  match,
  clubName,
  onOpenChat,
  className = "",
}) => {
  return (
    <div
      className={`p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm space-y-3 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h5 className="text-sm font-bold text-neutral-900 dark:text-white">
              Executive Mentor Pairing
            </h5>
            <p className="text-xs text-neutral-500">
              Role: <span className="font-semibold text-neutral-700 dark:text-neutral-300">{match.role_title}</span>
              {clubName ? ` • ${clubName}` : ""}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <Clock className="w-3 h-3" />
          {match.status.toUpperCase()}
        </span>
      </div>

      {match.intro_message && (
        <p className="text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/60 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800">
          "{match.intro_message}"
        </p>
      )}

      <div className="pt-1">
        <button
          onClick={() => onOpenChat && onOpenChat(match.channel_id)}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
        >
          <MessageSquare className="w-4 h-4" />
          Open Mentor Direct Messages
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
