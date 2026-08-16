// =============================================================================
// Component: IcebreakerSuggestions
// Issue: #3269 - Develop an 'Algorithmic Icebreaker' Engine for Networking Events
// Description: The main container for the Icebreaker tab on the live event page.
// Handles empty states, loading states, and triggers the initial generation
// of suggestions when the user first views the tab.
// =============================================================================

import React, { useEffect } from 'react';
import { useIcebreakers } from '../../hooks/useIcebreakers';
import { IcebreakerCard } from './IcebreakerCard';

interface IcebreakerSuggestionsProps {
    eventId: string;
    isCheckedIn: boolean;
}

export const IcebreakerSuggestions: React.FC<IcebreakerSuggestionsProps> = ({
    eventId,
    isCheckedIn
}) => {
    const { matches, isLoading, isGenerating, error, generateSuggestions, sendWave } = useIcebreakers(eventId);

    // Auto-generate suggestions when the component mounts if the user is checked in
    // and there are no existing matches loaded yet.
    useEffect(() => {
        if (isCheckedIn && !isLoading && matches.length === 0 && !error) {
            generateSuggestions();
        }
    }, [isCheckedIn, isLoading, matches.length, error, generateSuggestions]);

    if (!isCheckedIn) {
        return (
            <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Check-in Required</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    You must be physically checked in at the event to see AI-powered networking suggestions.
                </p>
            </div>
        );
    }

    if (isLoading || isGenerating) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-medium">Analyzing attendee profiles for matches...</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-center">
                <p className="font-bold mb-1">Failed to load suggestions</p>
                <p className="text-sm">{error}</p>
                <button
                    onClick={generateSuggestions}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (matches.length === 0) {
        return (
            <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Matches Yet</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                    Wait for more attendees to check in, or try refreshing to find new connections!
                </p>
                <button
                    onClick={generateSuggestions}
                    disabled={isGenerating}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                    Refresh Matches
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Suggested Connections</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        People here who share your interests and background.
                    </p>
                </div>
                <button
                    onClick={generateSuggestions}
                    disabled={isGenerating}
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {matches.map(match => (
                    <IcebreakerCard
                        key={match.id}
                        match={match}
                        onWave={sendWave}
                    />
                ))}
            </div>
        </div>
    );
};
