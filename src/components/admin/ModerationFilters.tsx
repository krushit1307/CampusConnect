// =============================================================================
// Component: ModerationFilters
// Issue: #3321 - Implement 'Role-Based Content Moderation Queues'
// Description: Sidebar filters for the moderation dashboard.Only shows
// categories that the current user has permission to moderate.
//  =============================================================================

import React from 'react';
import { ReportCategory } from '../../hooks/useModerationQueue';

interface ModerationFiltersProps {
    permissions: { spam: boolean; safety: boolean; all: boolean };
    activeFilter: ReportCategory | 'all';
    onFilterChange: (filter: ReportCategory | 'all') => void;
    counts: Record<string, number>;
}

export const ModerationFilters: React.FC<ModerationFiltersProps> = ({
    permissions,
    activeFilter,
    onFilterChange,
    counts
}) => {

    const categories: { id: ReportCategory | 'all'; label: string; icon: string; requires: 'all' | 'spam' | 'safety' }[] = [
        { id: 'all', label: 'My Queue', icon: '📥', requires: 'all' },
        { id: 'danger', label: 'Immediate Danger', icon: '🚨', requires: 'safety' },
        { id: 'harassment', label: 'Harassment', icon: '⚠️', requires: 'safety' },
        { id: 'spam', label: 'Spam & Scams', icon: '🗑️', requires: 'spam' },
        { id: 'misinformation', label: 'Misinformation', icon: '📰', requires: 'spam' },
        { id: 'copyright', label: 'Copyright', icon: '©️', requires: 'spam' },
    ];

    // Filter categories based on user permissions
    const visibleCategories = categories.filter(cat => {
        if (permissions.all) return true;
        if (cat.requires === 'spam' && permissions.spam) return true;
        if (cat.requires === 'safety' && permissions.safety) return true;
        return cat.id === 'all'; // Always show "My Queue"
    });

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-1">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-2">
                Report Categories
            </h3>

            {visibleCategories.map(cat => {
                const isActive = activeFilter === cat.id;
                const count = cat.id === 'all'
                    ? Object.values(counts).reduce((a, b) => a + b, 0)
                    : counts[cat.id] || 0;

                return (
                    <button
                        key={cat.id}
                        onClick={() => onFilterChange(cat.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                        </div>
                        {count > 0 && (
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${isActive
                                ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                }`}>
                                {count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};
