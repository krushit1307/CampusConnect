// =============================================================================
// Component: ClashNegotiationModal
// Issue: #3708 - Implement 'Automated "Event Clash" Negotiation'
// Description: Blocks the Publish flow when a severe clash is detected. Lists
// every conflicting event with shared-member metrics, links to the negotiation
// DM channel, and offers a 1-click "Acknowledge & Publish Anyway" escape hatch.
// =============================================================================

import React from 'react';
import { ClashResult, clashSummary } from '../../lib/events/clashDetection';

interface ClashNegotiationModalProps {
    clashes: ClashResult[];
    isPublishing: boolean;
    onOpenNegotiation: (channelId: string) => void;
    onAcknowledge: () => void;
    onCancel: () => void;
}

export const ClashNegotiationModal: React.FC<ClashNegotiationModalProps> = ({
    clashes, isPublishing, onOpenNegotiation, onAcknowledge, onCancel,
}) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-amber-200 dark:border-amber-800">
                {/* Header */}
                <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-start gap-4">
                    <div className="flex-shrink-0 w-11 h-11 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">Event Clash Detected</h3>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                            Publishing is paused. Your flagship event conflicts with another major organization's event.
                        </p>
                    </div>
                </div>

                {/* Clash list */}
                <div className="p-6 space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
                    {clashes.map(c => (
                        <div key={c.other_event_id} className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-bold text-gray-900 dark:text-white">{c.other_title}</h4>
                                <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-full">
                                    {c.overlap_pct}% shared
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{clashSummary(c)}</p>
                            {c.negotiation_channel_id && (
                                <button
                                    onClick={() => onOpenNegotiation(c.negotiation_channel_id!)}
                                    className="mt-3 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                    💬 Open negotiation channel with {c.other_club_name}
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <button
                        onClick={onAcknowledge}
                        disabled={isPublishing}
                        className="w-full py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-bold text-sm"
                    >
                        {isPublishing ? 'Publishing…' : 'Acknowledge & Publish Anyway'}
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm font-medium"
                    >
                        Keep as Draft (coordinate first)
                    </button>
                </div>
            </div>
        </div>
    );
};
