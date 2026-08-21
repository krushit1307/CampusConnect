// =============================================================================
// Component: PrerequisiteWarning
// Issue: #3224 - Implement 'Event Series Dependencies'(Prerequisites)
// Description: Displays a blocking warning on the Event Page if the user
// has not attended the required prerequisite events.Supports conditional
// RSVP messaging if the organizer allows pre - registration.
// =============================================================================

import React from 'react';
import { PrerequisiteCheckResult } from '../../hooks/useEventPrerequisites';

interface PrerequisiteWarningProps {
    result: PrerequisiteCheckResult | null;
    isLoading: boolean;
}

export const PrerequisiteWarning: React.FC<PrerequisiteWarningProps> = ({ result, isLoading }) => {
    if (isLoading || !result || result.isEligible) return null;

    const { missingPrerequisites, allowConditional, hasOverride } = result;

    if (hasOverride) return null; // Organizer manually bypassed them

    return (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-r-lg shadow-sm">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                    <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="text-base font-bold text-amber-800 dark:text-amber-300 mb-1">
                        Prerequisites Not Met
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                        You cannot RSVP for this event because you did not attend the following required sessions:
                    </p>

                    <ul className="list-disc list-inside space-y-1 mb-4">
                        {missingPrerequisites.map((title, idx) => (
                            <li key={idx} className="text-sm font-medium text-amber-900 dark:text-amber-200">
                                {title}
                            </li>
                        ))}
                    </ul>

                    {allowConditional ? (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-xs text-blue-800 dark:text-blue-300 font-medium flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Conditional RSVP Allowed: You may reserve your spot now, but your ticket will be automatically revoked if you fail to attend the missing prerequisite sessions.
                            </p>
                        </div>
                    ) : (
                        <p className="text-xs text-amber-600 dark:text-amber-500 italic">
                            Please attend the missing sessions to unlock RSVP access, or contact the organizer if you require a manual override.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
