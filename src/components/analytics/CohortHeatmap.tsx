// =============================================================================
// Component: CohortHeatmap
//  Issue: #3285 - Implement 'Event Attendance Analytics' (Retention Rate)
//  Description: Renders a visual heatmap/grid showing the retention rate of 
//  a base cohort across all subsequent events. Uses color intensity to 
//  represent the percentage of returning attendees.
// =============================================================================

import React from 'react';
import { RetentionDataPoint } from '../../hooks/useRetentionAnalytics';

interface CohortHeatmapProps {
    data: RetentionDataPoint[];
    baseEventTitle: string;
}

export const CohortHeatmap: React.FC<CohortHeatmapProps> = ({ data, baseEventTitle }) => {

    if (data.length === 0) {
        return (
            <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                <p>No subsequent events found to calculate retention.</p>
            </div>
        );
    }

    // Determine color based on retention rate
    const getColorClass = (rate: number): string => {
        if (rate >= 80) return 'bg-green-500 text-white';
        if (rate >= 60) return 'bg-green-400 text-white';
        if (rate >= 40) return 'bg-yellow-400 text-gray-900';
        if (rate >= 20) return 'bg-orange-400 text-white';
        return 'bg-red-500 text-white';
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Cohort Retention Matrix</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Tracking the <span className="font-bold text-gray-900 dark:text-white">{data[0].base_attendee_count}</span> attendees from <span className="font-bold text-indigo-600 dark:text-indigo-400">{baseEventTitle}</span>.
            </p>

            <div className="space-y-3">
                {data.map((point) => (
                    <div key={point.subsequent_event_id} className="flex items-center gap-4">
                        {/* Event Info */}
                        <div className="w-1/3 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate text-sm">
                                {point.subsequent_event_title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(point.subsequent_event_date).toLocaleDateString()}
                            </p>
                        </div>

                        {/* Heatmap Bar */}
                        <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative">
                                <div
                                    className={`h-full flex items-center justify-center transition-all duration-500 ${getColorClass(point.retention_rate)}`}
                                    style={{ width: `${Math.max(5, point.retention_rate)}%` }}
                                >
                                    <span className="text-xs font-bold drop-shadow-sm">
                                        {point.retention_rate}%
                                    </span>
                                </div>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right flex-shrink-0">
                                {point.returning_attendee_count}/{point.base_attendee_count}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-4 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <div className="w-3 h-3 rounded bg-red-500"></div>
                    <span>&lt;20%</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <div className="w-3 h-3 rounded bg-orange-400"></div>
                    <span>20-39%</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <div className="w-3 h-3 rounded bg-yellow-400"></div>
                    <span>40-59%</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <div className="w-3 h-3 rounded bg-green-400"></div>
                    <span>60-79%</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    <span>80%+</span>
                </div>
            </div>
        </div>
    );
};
