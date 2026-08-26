// =============================================================================
// Component: AccessibilityBadge
// Issue: #3324 - Implement 'Automated Dorm vs Commuter Demographic Tagging'
// Description: Renders visual badges on the public Event Card to inform
// attendees about the temporal and physical accessibility of the event.
// =============================================================================

import React from 'react';
import { AccessibilityTag } from '../../lib/events/accessibility';

interface AccessibilityBadgeProps {
    tags: AccessibilityTag[];
}

export const AccessibilityBadge: React.FC<AccessibilityBadgeProps> = ({ tags }) => {
    if (!tags || tags.length === 0) return null;

    const getTagConfig = (tag: AccessibilityTag) => {
        switch (tag) {
            case 'commuter-friendly':
                return {
                    bg: 'bg-green-100 dark:bg-green-900/30',
                    text: 'text-green-800 dark:text-green-300',
                    border: 'border-green-200 dark:border-green-800',
                    icon: (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    ),
                    label: 'Commuter Friendly'
                };
            case 'dorm-only':
                return {
                    bg: 'bg-red-100 dark:bg-red-900/30',
                    text: 'text-red-800 dark:text-red-300',
                    border: 'border-red-200 dark:border-red-800',
                    icon: (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                    ),
                    label: 'Dorm Residents Only'
                };
            case 'late-night':
                return {
                    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
                    text: 'text-indigo-800 dark:text-indigo-300',
                    border: 'border-indigo-200 dark:border-indigo-800',
                    icon: (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    ),
                    label: 'Late Night'
                };
            default:
                return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', icon: null, label: tag };
        }
    };

    return (
        <div className="flex flex-wrap gap-2">
            {tags.map(tag => {
                const config = getTagConfig(tag);
                return (
                    <span
                        key={tag}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${config.bg} ${config.text} ${config.border}`}
                    >
                        {config.icon}
                        {config.label}
                    </span>
                );
            })}
        </div>
    );
};
