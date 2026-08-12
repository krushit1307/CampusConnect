// =============================================================================
// Component: QuestionCard
--Issue: #2898 - Develop a Real - Time 'Live Q&A' Module for Events
--Description: Renders an individual question in the Live Q & A feed.
--Includes the upvote button with micro - animations and moderator actions.
// =============================================================================

import React, { useState } from 'react';
import { LiveQuestion } from '../../hooks/useLiveQA';

interface QuestionCardProps {
    question: LiveQuestion;
    onUpvote: (id: string) => void;
    onMarkAnswered?: (id: string) => void;
    onDelete?: (id: string) => void;
    isModerator?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
    question,
    onUpvote,
    onMarkAnswered,
    onDelete,
    isModerator = false
}) => {
    const [isAnimating, setIsAnimating] = useState(false);

    const handleUpvote = () => {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
        onUpvote(question.id);
    };

    const timeAgo = (dateStr: string) => {
        const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        return `${Math.floor(seconds / 3600)}h ago`;
    };

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex gap-4">
            {/* Upvote Column */}
            <div className="flex flex-col items-center gap-1 pt-1">
                <button
                    onClick={handleUpvote}
                    className={`
            p-2 rounded-lg transition-all
            ${question.has_upvoted
                            ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
                            : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-indigo-500'
                        }
            ${isAnimating ? 'scale-125' : 'scale-100'}
          `}
                    aria-label={question.has_upvoted ? 'Remove upvote' : 'Upvote question'}
                >
                    <svg className="w-6 h-6" fill={question.has_upvoted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                </button>
                <span className={`text-sm font-bold ${question.has_upvoted ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {question.upvotes}
                </span>
            </div>

            {/* Content Column */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                    {question.profiles?.avatar_url ? (
                        <img
                            src={question.profiles.avatar_url}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                        />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">
                            {question.profiles?.full_name?.charAt(0) || '?'}
                        </div>
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {question.profiles?.full_name || 'Anonymous'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        • {timeAgo(question.created_at)}
                    </span>
                </div>

                <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                    {question.content}
                </p>

                {/* Moderator Actions */}
                {isModerator && (
                    <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <button
                            onClick={() => onMarkAnswered?.(question.id)}
                            className="text-xs font-medium text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Mark Answered
                        </button>
                        <button
                            onClick={() => onDelete?.(question.id)}
                            className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete & Ban
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
