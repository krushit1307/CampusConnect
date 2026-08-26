// =============================================================================
// Component: IcebreakerCard
// Issue: #3269 - Develop an 'Algorithmic Icebreaker' Engine for Networking Events
// Description: Renders an individual suggested connection.Displays the user's 
// profile, the generated conversational prompt, shared interests, and the
//  "Waved" interaction button.
// =============================================================================

import React from 'react';
import { IcebreakerMatch } from '../../hooks/useIcebreakers';

interface IcebreakerCardProps {
    match: IcebreakerMatch;
    onWave: (connectionId: string) => void;
}

export const IcebreakerCard: React.FC<IcebreakerCardProps> = ({ match, onWave }) => {
    const matchPercentage = Math.round(match.similarity_score * 100);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
            {/* Profile Header */}
            <div className="flex items-center gap-4 mb-4">
                {match.profiles?.avatar_url ? (
                    <img
                        src={match.profiles.avatar_url}
                        alt={match.profiles.full_name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-indigo-100 dark:border-indigo-900"
                    />
                ) : (
                    <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xl">
                        {match.profiles?.full_name?.charAt(0) || '?'}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white truncate">
                        {match.profiles?.full_name || 'Attendee'}
                    </h3>
                    {match.profiles?.major && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {match.profiles.major}
                        </p>
                    )}
                </div>
                <div className="text-right flex-shrink-0">
                    <div className={`text-lg font-black ${matchPercentage >= 70 ? 'text-green-600 dark:text-green-400' :
                        matchPercentage >= 40 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-gray-500 dark:text-gray-400'
                        }`}>
                        {matchPercentage}%
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Match
                    </div>
                </div>
            </div>

            {/* Conversational Prompt */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 mb-4 flex-1">
                <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed">
                        {match.conversation_prompt}
                    </p>
                </div>
            </div>

            {/* Shared Interests Tags */}
            {match.shared_interests.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {match.shared_interests.slice(0, 4).map(tag => (
                        <span
                            key={tag}
                            className="px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                        >
                            #{tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Wave Button */}
            <button
                onClick={() => onWave(match.id)}
                disabled={match.has_waved}
                className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${match.has_waved
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] shadow-sm'
                    }`}
            >
                {match.has_waved ? (
                    <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Connection Made!
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                        </svg>
                        Say Hi (Wave)
                    </>
                )}
            </button>
        </div>
    );
};