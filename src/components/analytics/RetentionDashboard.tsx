// =============================================================================
// Component: RetentionDashboard
//  Issue: #3285 - Implement 'Event Attendance Analytics' (Retention Rate)
//  Description: The main Organizer Dashboard container for retention analytics.
//  Provides a dropdown to select the "Base Event" cohort and renders the 
//  Cohort Heatmap and Churn Demographics components.
// =============================================================================

import React from 'react';
import { useRetentionAnalytics } from '../../hooks/useRetentionAnalytics';
import { CohortHeatmap } from './CohortHeatmap';
import { ChurnDemographics } from './ChurnDemographics';

interface RetentionDashboardProps {
    clubId: string;
}

export const RetentionDashboard: React.FC<RetentionDashboardProps> = ({ clubId }) => {
    const {
        pastEvents,
        selectedBaseEvent,
        setSelectedBaseEvent,
        retentionMatrix,
        churnData,
        isLoading,
        error,
        triggerReengagementEmail
    } = useRetentionAnalytics(clubId);

    const nextEventId = retentionMatrix.length > 0 ? retentionMatrix[0].subsequent_event_id : null;

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
            {/* Header & Selector */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">Retention Analytics</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Track how many attendees return for subsequent events and identify demographic churn.
                    </p>
                </div>

                <div className="w-full md:w-64">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Base Cohort Event
                    </label>
                    <select
                        value={selectedBaseEvent?.id || ''}
                        onChange={(e) => {
                            const event = pastEvents.find(ev => ev.id === e.target.value);
                            setSelectedBaseEvent(event || null);
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                    >
                        {pastEvents.map(event => (
                            <option key={event.id} value={event.id}>
                                {event.title} ({event.attendee_count} att.)
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-6 animate-pulse">
                    <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                    <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                </div>
            ) : error ? (
                <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-center">
                    {error}
                </div>
            ) : !selectedBaseEvent ? (
                <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400">Select a past event to analyze its cohort retention.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Retention Matrix */}
                    <CohortHeatmap
                        data={retentionMatrix}
                        baseEventTitle={selectedBaseEvent.title}
                    />

                    {/* Churn Demographics */}
                    <ChurnDemographics
                        data={churnData}
                        subsequentEventId={nextEventId}
                        onReengage={triggerReengagementEmail}
                    />
                </div>
            )}
        </div>
    );
};
