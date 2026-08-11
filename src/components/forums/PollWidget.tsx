// =============================================================================
// Component: PollWidget
// Issue: #2819 - Implement Real - Time Polling Widget Embeddable in Markdown
// Description: The interactive React component rendered in place of the
// custom AST node.Displays options, handles voting, and animates progress
// bars in real - time using Supabase Realtime.
// =============================================================================

import React, { useState } from "react";
import { usePoll } from "../../hooks/usePoll";

interface PollWidgetProps {
  pollId: string | null; // If null, it's a preview/unlinked poll
  options: string[];
  question?: string;
}

export const PollWidget: React.FC<PollWidgetProps> = ({ pollId, options, question }) => {
  const {
    options: pollOptions,
    totalVotes,
    userVoteIndex,
    isLoading,
    hasVoted,
    castVote,
    changeVote,
  } = usePoll(pollId, options);

  const [selectedPreview, setSelectedPreview] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="my-6 p-6 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl animate-pulse">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="space-y-3">
          {options.map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  // If no pollId, render a static preview (e.g., in the markdown editor)
  if (!pollId) {
    return (
      <div className="my-6 p-6 bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-3 uppercase tracking-wider">
          Poll Preview
        </p>
        <p className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {question || "What should we order for Friday?"}
        </p>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div
              key={i}
              className="px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 font-medium"
            >
              {opt}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="my-6 p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {question || "Community Poll"}
        </h3>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
          {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
        </span>
      </div>

      <div className="space-y-3">
        {pollOptions.map((opt, index) => {
          const isSelected = userVoteIndex === index;
          const isPreviewSelected = selectedPreview === index && !hasVoted;

          return (
            <button
              key={index}
              onClick={() => (hasVoted ? changeVote(index) : castVote(index))}
              onMouseEnter={() => !hasVoted && setSelectedPreview(index)}
              onMouseLeave={() => !hasVoted && setSelectedPreview(null)}
              disabled={!pollId}
              className={`
                relative w-full text-left p-3 rounded-lg border-2 transition-all duration-300 overflow-hidden group
                ${
                  isSelected
                    ? "border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                    : isPreviewSelected
                      ? "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }
              `}
            >
              {/* Progress Bar Background */}
              {hasVoted && (
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-700 ease-out ${
                    isSelected
                      ? "bg-indigo-200 dark:bg-indigo-800/40"
                      : "bg-gray-100 dark:bg-gray-700/50"
                  }`}
                  style={{ width: `${opt.percentage}%` }}
                ></div>
              )}

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Radio/Check Indicator */}
                  <div
                    className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                    ${
                      isSelected
                        ? "border-indigo-600 dark:border-indigo-400 bg-indigo-600 dark:bg-indigo-500"
                        : "border-gray-300 dark:border-gray-600 group-hover:border-gray-400 dark:group-hover:border-gray-500"
                    }
                  `}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>

                  <span
                    className={`font-medium ${
                      isSelected
                        ? "text-indigo-900 dark:text-indigo-100"
                        : "text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {opt.text}
                  </span>
                </div>

                {/* Percentage / Vote Count */}
                {hasVoted && (
                  <span
                    className={`text-sm font-bold ${
                      isSelected
                        ? "text-indigo-700 dark:text-indigo-300"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {opt.percentage.toFixed(1)}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {hasVoted && (
        <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
          Click an option to change your vote. Results update in real-time.
        </p>
      )}
    </div>
  );
};
