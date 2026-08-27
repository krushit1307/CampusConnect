// =============================================================================
// Component: NoShowAnalyticsChart
//  Issue: #3563 - Implement 'Automated Post-Event "No-Show" Feedback Loop'
//  Description: Renders a horizontal bar chart displaying the aggregated
//  reasons why users didn't attend an event. Provides actionable insights
//  to organizers on the Organizer ROI Dashboard.
// =============================================================================

import React from 'react';
import { useNoShowAnalytics, NoShowReason } from '../../hooks/useNoShowAnalytics';

interface NoShowAnalyticsChartProps {
    eventId: string;
}

// Map reasons to user-friendly labels and colors
const REASON_CONFIG: Record<NoShowReason, { label: string; color: string }> = {
    forgot: { label: 'Simply Forgot', color: 'bg-gray-400 dark:bg-gray-500' },
    too_much_homework: { label: 'Academic Workload', color: 'bg-blue-500 dark:bg-blue-600' },
    transportation: { label: 'Transportation Issues', color: 'bg-amber-500 dark:bg-amber-600' },
    felt_sick: { label: 'Felt Sick / Health', color: 'bg-red-500 dark:bg-red-600' },
    schedule_conflict: { label: 'Schedule Conflict', color: 'bg-purple-500 dark:bg-purple-600' },
    lost_interest: { label: 'Lost Interest', color: 'bg-pink-500 dark:bg-pink-600' },
    other: { label: 'Other Reason', color: 'bg-teal-500 dark:bg-teal-600' }
};

export const NoShowAnalyticsChart: React.FC<NoShowAnalyticsChartProps> = ({ eventId }) => {
    const { data, totalNoShows, totalResponses, isLoading, error } = useNoShowAnalytics(eventId);

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse"></div>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>)}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                {error}
            </div>
        );
    }

    const responseRate = totalNoShows > 0 ? Math.round((totalResponses / totalNoShows) * 100) : 0;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">No-Show Analysis</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Why attendees didn't show up
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{totalNoShows}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">Total No-Shows</p>
                </div>
            </div>

            {totalNoShows === 0 ? (
                <div className="text-center py-8 text-green-600 dark:text-green-400">
                    <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-bold">Perfect Attendance!</p>
                    <p className="text-sm mt-1">Everyone who RSVP'd showed up.</p>
                </div>
            ) : totalResponses === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p className="font-medium">No feedback collected yet.</p>
                    <p className="text-sm mt-1">Surveys are sent 24 hours after the event ends.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Response Rate Banner */}
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-between">
                        <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">Survey Response Rate</span>
                        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{responseRate}%</span>
                    </div>

                    {/* Bar Chart */}
                    <div className="space-y-3">
                        {data.map(item => {
                            const config = REASON_CONFIG[item.reason] || REASON_CONFIG.other;
                            return (
                                <div key={item.reason}>
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {config.label}
                                        </span>
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                            {item.count} responses ({item.percentage}%)
                                        </span>
                                    </div>
                                    <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ease-out ${config.color}`}
                                            style={{ width: `${item.percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
