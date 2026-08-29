// =============================================================================
// Component: NetworkingSettingsToggle
// Issue: #3697 - Develop a 'Dynamic "Blind Networking" Matchmaker'
// Description: Opt-in switch ("Available for Coffee Chats") plus the "Find my
// match" action. Clearly explains the cross-discipline matching rule.
// =============================================================================

import React from 'react';
import { useBlindNetworking } from '../../hooks/useBlindNetworking';

export const NetworkingSettingsToggle: React.FC = () => {
    const { isActive, isMatching, error, toggleActive, findMatch } = useBlindNetworking();

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Blind Networking</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Get matched with a student from a <span className="font-semibold">completely different department</span> for a coffee chat. Break out of your academic bubble.
                    </p>
                </div>

                {/* Availability switch */}
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => toggleActive(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
            </div>

            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <button
                onClick={findMatch}
                disabled={!isActive || isMatching}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm shadow-sm flex items-center justify-center gap-2"
            >
                {isMatching ? (
                    <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        Finding your match…
                    </>
                ) : (
                    '☕ Find My Match'
                )}
            </button>

            {!isActive && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Toggle availability on to start meeting people outside your major.
                </p>
            )}
        </div>
    );
};
