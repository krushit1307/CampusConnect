// =============================================================================
// Component: LeaderboardTable
--Issue: #2971 - Develop a 'Cross-Club Leaderboard'(Gamification)
--Description: Renders the full ranked table of clubs below the podium.
--Includes trending indicators(up / down arrows) and detailed metric breakdowns.
// =============================================================================

import React from 'react';
import { LeaderboardEntry } from '../../hooks/useLeaderboard';

interface LeaderboardTableProps {
    entries: LeaderboardEntry[];
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ entries }) => {
    // Skip the top 3 as they are shown in the podium
    const tableEntries = entries.slice(3);

    if (tableEntries.length === 0) return null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rank</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Club</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Events</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Engagement</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Quality</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Score</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {tableEntries.map((entry) => (
                        <tr key={entry.club_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold text-gray-900 dark:text-white w-8 text-center">
                                        {entry.rank}
                                    </span>
                                    <TrendIndicator trend={entry.trend} change={entry.rank_change} />
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                                        {entry.logo_url ? (
                                            <img src={entry.logo_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center font-bold text-gray-500 dark:text-gray-400">
                                                {entry.club_name.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">{entry.club_name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{entry.total_members} members</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600 dark:text-gray-300 hidden md:table-cell">
                                {entry.valid_events_hosted}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600 dark:text-gray-300 hidden md:table-cell">
                                {Math.round((entry.unique_attendees / entry.total_members) * 100)}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600 dark:text-gray-300 hidden md:table-cell">
                                {entry.avg_feedback_score > 0 ? entry.avg_feedback_score.toFixed(1) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                                    {entry.total_score.toLocaleString()}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

/**
 * Sub-component: Trending Indicator
 */
const TrendIndicator: React.FC<{ trend: string; change: number }> = ({ trend, change }) => {
    if (trend === 'up') {
        return (
            <span className="flex items-center text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
                <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                {change}
            </span>
        );
    }
    if (trend === 'down') {
        return (
            <span className="flex items-center text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full">
                <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                {Math.abs(change)}
            </span>
        );
    }
    if (trend === 'new') {
        return (
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full uppercase">
                New
            </span>
        );
    }
    return (
        <span className="text-gray-400 dark:text-gray-600 text-lg">-</span>
    );
};
