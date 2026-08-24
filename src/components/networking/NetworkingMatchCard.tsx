// =============================================================================
// Component: NetworkingMatchCard
// Issue: #3697 - Develop a 'Dynamic "Blind Networking" Matchmaker'
// Description: Displays an active match with the partner's identity, the three
// icebreaker prompts, a "Start Chat" CTA and a frictionless "Report User"
// safety action.
// =============================================================================

import React, { useState } from 'react';
import { NetworkingMatch } from '../../hooks/useBlindNetworking';

interface NetworkingMatchCardProps {
    match: NetworkingMatch;
    onStartChat: (channelId: string) => void;
    onReport: (matchId: string, reason: string) => void;
}

export const NetworkingMatchCard: React.FC<NetworkingMatchCardProps> = ({ match, onStartChat, onReport }) => {
    const [showReport, setShowReport] = useState(false);
    const [reason, setReason] = useState('');

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            {/* Partner header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-black text-lg">
                    {match.partnerName.charAt(0)}
                </div>
                <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">{match.partnerName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{match.partnerMajor} major</p>
                </div>
            </div>

            {/* Icebreakers */}
            {match.icebreakers.length > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 mb-4">
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider mb-2">
                        Icebreakers to get you started
                    </p>
                    <ol className="space-y-1.5">
                        {match.icebreakers.map((q, i) => (
                            <li key={i} className="text-sm text-indigo-900 dark:text-indigo-200 flex gap-2">
                                <span className="font-bold text-indigo-500">{i + 1}.</span>
                                <span>{q}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => match.channelId && onStartChat(match.channelId)}
                    disabled={!match.channelId}
                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-bold text-sm"
                >
                    Start Chat
                </button>
                <button
                    onClick={() => setShowReport(!showReport)}
                    className="px-3 py-2.5 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium"
                >
                    Report
                </button>
            </div>

            {/* Inline report form */}
            {showReport && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-2">
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        placeholder="Why are you reporting this match?"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => { onReport(match.id, reason || 'No reason given'); setShowReport(false); }}
                            className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold"
                        >
                            Submit Report
                        </button>
                        <button
                            onClick={() => setShowReport(false)}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
