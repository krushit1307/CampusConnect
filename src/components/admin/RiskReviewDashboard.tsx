// =============================================================================
// Component: RiskReviewDashboard
//Issue: #3336 - Implement 'Automated Event Risk Assessment' Scoring
//Description: The admin portal for Campus Safety to review quarantined events.
//Displays the algorithmic risk score, flagged heuristics, and allows
//manual approval or rejection of the event.
// =============================================================================

import React, { useState } from 'react';
import { useRiskAssessment, QuarantinedEvent } from '../../hooks/useRiskAssessment';

export const RiskReviewDashboard: React.FC = () => {
    const { queue, isLoading, error, approveEvent, rejectEvent } = useRiskAssessment();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleApprove = async (id: string) => {
        setProcessingId(id);
        await approveEvent(id);
        setProcessingId(null);
    };

    const handleReject = async (id: string) => {
        if (!confirm('Are you sure you want to reject this event? The organizer will be notified.')) return;
        setProcessingId(id);
        await rejectEvent(id);
        setProcessingId(null);
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Event Risk Assessment Queue
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Review events flagged by the automated algorithmic risk assessor.
                </p>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2].map(i => <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>)}
                </div>
            ) : error ? (
                <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-center">
                    {error}
                </div>
            ) : queue.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Queue is Clear</h3>
                    <p className="text-gray-500 dark:text-gray-400">No high-risk events pending review.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {queue.map(event => (
                        <RiskReviewCard
                            key={event.id}
                            event={event}
                            isProcessing={processingId === event.id}
                            onApprove={handleApprove}
                            onReject={handleReject}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const RiskReviewCard: React.FC<{
    event: QuarantinedEvent;
    isProcessing: boolean;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
}> = ({ event, isProcessing, onApprove, onReject }) => {

    const getScoreColor = (score: number) => {
        if (score >= 15) return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
        if (score >= 10) return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-6 flex flex-col md:flex-row md:items-center gap-6">
                {/* Risk Score Badge */}
                <div className={`flex-shrink-0 w-24 h-24 rounded-2xl flex flex-col items-center justify-center ${getScoreColor(event.risk_score)}`}>
                    <span className="text-3xl font-black">{event.risk_score}</span>
                    <span className="text-xs font-bold uppercase tracking-wider">Risk Score</span>
                </div>

                {/* Event Details */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate mb-1">
                        {event.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        Hosted by: <span className="font-medium">{event.clubs?.name || 'Unknown Club'}</span>
                    </p>

                    <div className="flex flex-wrap gap-2">
                        {event.risk_factors.map((factor, idx) => (
                            <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-bold rounded-full border border-red-200 dark:border-red-800"
                            >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {factor}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 flex-shrink-0 w-full md:w-auto">
                    <button
                        onClick={() => onApprove(event.id)}
                        disabled={isProcessing}
                        className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold text-sm shadow-sm flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Approve & Publish
                    </button>
                    <button
                        onClick={() => onReject(event.id)}
                        disabled={isProcessing}
                        className="px-6 py-2.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 font-bold text-sm"
                    >
                        Reject Event
                    </button>
                </div>
            </div>
        </div>
    );
};
