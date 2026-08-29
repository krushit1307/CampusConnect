// =============================================================================
// Component: SpeakerBioFetcher
//Issue: #3339 - Implement 'Automated Speaker Bio Fetching'
//Description: An input group for the Event Draft Wizard.Allows the organizer
//to paste a LinkedIn URL and click "Fetch Bio" to auto - populate the speaker's 
//name, photo, and professional summary via AI.
// =============================================================================

import React, { useState } from 'react';
import { useSpeakerBio, SpeakerData } from '../../hooks/useSpeakerBio';

interface SpeakerBioFetcherProps {
    onBioFetched: (data: SpeakerData) => void;
    initialUrl?: string;
}

export const SpeakerBioFetcher: React.FC<SpeakerBioFetcherProps> = ({ onBioFetched, initialUrl }) => {
    const { isFetching, error, fetchBio } = useSpeakerBio();
    const [url, setUrl] = useState(initialUrl || '');

    const handleFetch = async () => {
        if (!url.trim()) return;
        const data = await fetchBio(url);
        if (data) {
            onBioFetched(data);
        }
    };

    return (
        <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                Speaker LinkedIn URL
            </label>

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                        </svg>
                    </div>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/speaker-name"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        disabled={isFetching}
                    />
                </div>

                <button
                    onClick={handleFetch}
                    disabled={isFetching || !url.trim()}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm flex items-center gap-2 shadow-sm whitespace-nowrap"
                >
                    {isFetching ? (
                        <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Fetching...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Fetch Bio (AI)
                        </>
                    )}
                </button>
            </div>

            {error && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                </p>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
                Paste a public LinkedIn URL to automatically generate a professional biography using AI.
            </p>
        </div>
    );
};
