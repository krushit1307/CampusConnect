// =============================================================================
// Component: ModerationDashboard
//  Issue: #3321 - Implement 'Role-Based Content Moderation Queues'
//  Description: The main container for the moderation workflow. Combines the 
//  filters sidebar with the report queue. Ensures users only see reports they 
//  are authorized to handle based on their granular permissions.
//  =============================================================================

import React, { useState, useMemo } from 'react';
import { useModerationQueue, ReportCategory } from '../../hooks/useModerationQueue';
import { ReportCard } from './ReportCard';
import { ModerationFilters } from './ModerationFilters';

export const ModerationDashboard: React.FC = () => {
    const { reports, isLoading, error, permissions, resolveReport, dismissReport } = useModerationQueue();
    const [activeFilter, setActiveFilter] = useState<ReportCategory | 'all'>('all');

    // Calculate counts for the sidebar badges
    const counts = useMemo(() => {
        const c: Record<string, number> = {};
        reports.forEach(r => {
            c[r.category] = (c[r.category] || 0) + 1;
        });
        return c;
    }, [reports]);

    // Filter reports based on the active sidebar selection
    const filteredReports = useMemo(() => {
        if (activeFilter === 'all') return reports;
        return reports.filter(r => r.category === activeFilter);
    }, [reports, activeFilter]);

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">Moderation Queue</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Review and action reported content. Your view is filtered based on your assigned role.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Filters */}
                <aside className="lg:col-span-1">
                    <div className="sticky top-24">
                        <ModerationFilters
                            permissions={permissions}
                            activeFilter={activeFilter}
                            onFilterChange={setActiveFilter}
                            counts={counts}
                        />

                        {/* Permission Legend */}
                        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 space-y-2">
                            <p className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Your Permissions</p>
                            {permissions.all && <p className="flex items-center gap-2">✅ Super Admin (All Access)</p>}
                            {permissions.safety && <p className="flex items-center gap-2">🛡️ Safety Team (Harassment/Danger)</p>}
                            {permissions.spam && <p className="flex items-center gap-2">🗑️ Spam Moderator</p>}
                            {!permissions.all && !permissions.safety && !permissions.spam && (
                                <p className="text-red-500">⚠️ No moderation permissions assigned.</p>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Report Queue */}
                <main className="lg:col-span-3">
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>)}
                        </div>
                    ) : error ? (
                        <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-center">
                            {error}
                        </div>
                    ) : filteredReports.length === 0 ? (
                        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                            <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Queue is Clear!</h3>
                            <p className="text-gray-500 dark:text-gray-400">No pending reports in this category.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredReports.map(report => (
                                <ReportCard
                                    key={report.id}
                                    report={report}
                                    onResolve={resolveReport}
                                    onDismiss={dismissReport}
                                />
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
