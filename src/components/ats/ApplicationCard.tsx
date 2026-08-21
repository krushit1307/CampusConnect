// =============================================================================
// Component: ApplicationCard
--Issue: #2978 - Build a 'Club Application & Tryout' Workflow
--Description: Renders an individual applicant card for the Kanban board.
--Supports "Blind Review" mode which redacts the applicant's name and photo 
--to prevent unconscious bias during the initial screening phase.
// =============================================================================

import React from 'react';
import { Application } from '../../hooks/useApplications';

interface ApplicationCardProps {
    application: Application;
    isBlindReview: boolean;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
}

export const ApplicationCard: React.FC<ApplicationCardProps> = ({
    application,
    isBlindReview,
    isSelected,
    onToggleSelect
}) => {
    const submittedDate = new Date(application.submitted_at).toLocaleDateString();

    return (
        <div
            className={`bg-white dark:bg-gray-800 rounded-lg border shadow-sm hover:shadow-md transition-all cursor-pointer ${isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('applicationId', application.id)}
        >
            <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Checkbox for bulk selection */}
                        <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected
                                    ? 'bg-indigo-600 border-indigo-600'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                                }`}
                            onClick={(e) => { e.stopPropagation(); onToggleSelect(application.id); }}
                        >
                            {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>

                        {/* Avatar / Anonymous Icon */}
                        {isBlindReview ? (
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 flex-shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                                </svg>
                            </div>
                        ) : (
                            application.profiles?.avatar_url ? (
                                <img
                                    src={application.profiles.avatar_url}
                                    alt=""
                                    className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-700 flex-shrink-0"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm flex-shrink-0">
                                    {application.profiles?.full_name?.charAt(0) || '?'}
                                </div>
                            )
                        )}

                        <div className="min-w-0">
                            <h4 className="font-bold text-gray-900 dark:text-white truncate text-sm">
                                {isBlindReview ? 'Anonymous Applicant' : (application.profiles?.full_name || 'Unknown')}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Applied {submittedDate}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Application Snippet (First answer) */}
                <div className="mt-3 space-y-2">
                    {Object.entries(application.answers_json).slice(0, 2).map(([key, value]) => (
                        <div key={key} className="text-xs">
                            <span className="font-semibold text-gray-700 dark:text-gray-300 block mb-0.5 truncate">
                                {key}
                            </span>
                            <p className="text-gray-600 dark:text-gray-400 line-clamp-2">
                                {String(value)}
                            </p>
                        </div>
                    ))}
                </div>

                {isBlindReview && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                        Blind Review Active
                    </div>
                )}
            </div>
        </div>
    );
};
