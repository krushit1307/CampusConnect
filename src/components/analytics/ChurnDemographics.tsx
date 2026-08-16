// =============================================================================
// Component: ChurnDemographics
//  Issue: #3285 - Implement 'Event Attendance Analytics' (Retention Rate)
//  Description: Displays a breakdown of which specific demographics (Major + Year) 
//  attended the base event but churned (did not attend) the subsequent event.
//  Provides a 1-click button to trigger a re-engagement email campaign.
// =============================================================================

import React, { useState } from 'react';
import { ChurnDemographic as ChurnData } from '../../hooks/useRetentionAnalytics';

interface ChurnDemographicsProps {
    data: ChurnData[];
    subsequentEventId: string | null;
    onReengage: (eventId: string) => Promise<boolean>;
}

export const ChurnDemographics: React.FC<ChurnDemographicsProps> = ({
    data,
    subsequentEventId,
    onReengage
}) => {
    const [isSending, setIsSending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const handleReengage = async () => {
        if (!subsequentEventId) return;
        setIsSending(true);
        const success = await onReengage(subsequentEventId);
        setIsSending(false);
        if (success) setEmailSent(true);
    };

    if (data.length === 0) {
        return null; // No churn data to display
    }

    const totalChurned = data.reduce((sum, item) => sum + item.churned_count, 0);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Demographic Churn</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Who didn't come back? ({totalChurned} students lost)
                    </p>
                </div>

                {subsequentEventId && !emailSent && (
                    <button
                        onClick={handleReengage}
                        disabled={isSending}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2 shadow-sm"
                    >
                        {isSending ? (
                            <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Sending...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Email Churned Users
                            </>
                        )}
                    </button>
                )}

                {emailSent && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-bold">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Campaign Sent!
                    </div>
                )}
            </div>

            <div className="space-y-3">
                {data.map((item, index) => (
                    <div
                        key={`${item.major}-${item.graduation_year}`}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 font-bold text-xs">
                                #{index + 1}
                            </div>
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                    {item.major}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Class of {item.graduation_year}
                                </p>
                            </div>
                        </div>

                        <div className="text-right">
                            <p className="font-bold text-red-600 dark:text-red-400">
                                -{item.churned_count}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">students</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
