// =============================================================================
// Component: SpeakerProfileCard
//  Issue: #3339 - Implement 'Automated Speaker Bio Fetching'
//  Description: Renders the finalized speaker biography on the public Event Page.
//  Displays the AI-generated summary, headline, and profile photo beautifully.
// =============================================================================

import React from 'react';

interface SpeakerProfileCardProps {
    name: string;
    headline?: string;
    bio: string;
    photoUrl?: string | null;
    linkedinUrl?: string;
}

export const SpeakerProfileCard: React.FC<SpeakerProfileCardProps> = ({
    name,
    headline,
    bio,
    photoUrl,
    linkedinUrl
}) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Guest Speaker
            </h3>

            <div className="flex items-start gap-5">
                {/* Avatar */}
                <div className="flex-shrink-0">
                    {photoUrl ? (
                        <img
                            src={photoUrl}
                            alt={name}
                            className="w-20 h-20 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700 shadow-md"
                        />
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-2xl shadow-md">
                            {name.charAt(0)}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-xl font-black text-gray-900 dark:text-white truncate">
                            {name}
                        </h4>
                        {linkedinUrl && (
                            <a
                                href={linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                title="View LinkedIn Profile"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                </svg>
                            </a>
                        )}
                    </div>

                    {headline && (
                        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-3">
                            {headline}
                        </p>
                    )}

                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        {bio}
                    </p>
                </div>
            </div>
        </div>
    );
};
