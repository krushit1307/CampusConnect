// =============================================================================
// Page: ResourcesDirectory
// Issue: #3562 - Build an 'Interactive Campus "Safe Space" Directory'
// Description: The main route('/resources') containing the Safe Space Map
// and category filters.Integrates the Quick Escape button for digital safety.
// =============================================================================

import React from 'react';
import { useCampusResources, ResourceCategory } from '../hooks/useCampusResources';
import { ResourceMap } from '../components/resources/ResourceMap';
import { QuickEscapeButton } from '../components/resources/QuickEscapeButton';

const CATEGORIES: { id: ResourceCategory | 'all'; label: string; icon: string }[] = [
    { id: 'all', label: 'All Resources', icon: '🗺️' },
    { id: 'mental_health', label: 'Mental Health', icon: '🧠' },
    { id: 'counseling', label: 'Counseling', icon: '💬' },
    { id: 'lgbtq_center', label: 'LGBTQ+ Center', icon: '🏳️‍🌈' },
    { id: 'womens_center', label: 'Women\'s Center', icon: '♀️' },
    { id: 'security', label: 'Campus Security', icon: '🛡️' },
    { id: 'medical', label: 'Medical', icon: '🏥' },
    { id: 'spiritual', label: 'Spiritual', icon: '🕊️' }
];

export const ResourcesDirectory: React.FC = () => {
    const { filteredResources, isLoading, error, activeCategory, setActiveCategory } = useCampusResources();
    const [selectedResource, setSelectedResource] = React.useState<any>(null);

    if (isLoading) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
                <div className="h-[600px] bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
            {/* Quick Escape Button (Critical Safety Feature) */}
            <QuickEscapeButton />

            {/* Header */}
            <div className="space-y-2">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                    Campus Safe Space Directory
                </h1>
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
                    Find certified safe spaces, mental health counselors, and identity centers on campus. All locations marked as "Confidential" guarantee privacy.
                </p>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg">
                    {error}
                </div>
            )}

            {/* Category Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => {
                            setActiveCategory(cat.id);
                            setSelectedResource(null);
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === cat.id
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                    </button>
                ))}
            </div>

            {/* Map and Details */}
            <ResourceMap
                resources={filteredResources}
                selectedResource={selectedResource}
                onSelectResource={setSelectedResource}
            />

            {/* Emergency Banner */}
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-lg">
                <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <div>
                        <h3 className="font-bold text-red-800 dark:text-red-300">In Immediate Danger?</h3>
                        <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                            If you are in immediate physical danger, call <a href="tel:911" className="font-bold underline">911</a> or Campus Security Dispatch at <a href="tel:555-9111" className="font-bold underline">555-9111</a> immediately.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
