// =============================================================================
// Component: CommuterWarningBanner
//  Issue: #3324 - Implement 'Automated Dorm vs Commuter Demographic Tagging'
//  Description: Displayed in the Event Creation Wizard when the organizer 
//  selects an end time that negatively impacts commuter students.
// =============================================================================

import React from 'react';
import { evaluateCommuterAccessibility, formatCommuterWarning } from '../../lib/events/accessibility';

interface CommuterWarningBannerProps {
    endTime: string;
    commuterPercentage: number;
}

export const CommuterWarningBanner: React.FC<CommuterWarningBannerProps> = ({
    endTime,
    commuterPercentage
}) => {
    if (!endTime) return null;

    const analysis = evaluateCommuterAccessibility(endTime);
    if (!analysis.isLate) return null;

    const message = formatCommuterWarning(analysis.warningMessage || '', commuterPercentage);

    const bgColor = analysis.riskLevel === 'high'
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';

    const textColor = analysis.riskLevel === 'high'
        ? 'text-red-800 dark:text-red-300'
        : 'text-amber-800 dark:text-amber-300';

    const iconColor = analysis.riskLevel === 'high'
        ? 'text-red-600 dark:text-red-400'
        : 'text-amber-600 dark:text-amber-400';

    return (
        <div className={`p-4 border-l-4 rounded-r-lg ${bgColor} animate-slide-down`}>
            <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 mt-0.5 ${iconColor}`}>
                    {analysis.riskLevel === 'high' ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    )}
                </div>
                <div className="flex-1">
                    <h3 className={`text-sm font-bold ${textColor}`}>
                        Commuter Accessibility Warning
                    </h3>
                    <p className={`text-sm mt-1 ${textColor} opacity-90`}>
                        {message}
                    </p>
                </div>
            </div>

            <style>{`
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out forwards;
        }
      `}</style>
        </div>
    );
};
