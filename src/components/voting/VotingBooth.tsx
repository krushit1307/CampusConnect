// =============================================================================
// Component: VotingBooth
// Issue: #3231 - Develop a 'Secure Digital Voting Ballot' for Student Union
// Description: The secure interface where students cast their votes. Displays 
// candidates, handles the cryptographic hashing, and presents the tracking 
// number receipt upon successful submission.
// =============================================================================

import React, { useState } from 'react';
import { useElections, Election, Candidate } from '../../hooks/useElections';

export const VotingBooth: React.FC = () => {
    const { activeElections, candidates, hasVoted, isLoading, castVote } = useElections();
    const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [receipt, setReceipt] = useState<{ electionId: string; trackingNumber: string } | null>(null);

    const handleSelect = (electionId: string, candidateId: string) => {
        setSelectedCandidates(prev => ({ ...prev, [electionId]: candidateId }));
    };

    const handleSubmit = async (electionId: string) => {
        const candidateId = selectedCandidates[electionId];
        if (!candidateId) return;

        setIsSubmitting(true);
        const trackingNumber = await castVote(electionId, candidateId);
        setIsSubmitting(false);

        if (trackingNumber) {
            setReceipt({ electionId, trackingNumber });
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    if (isLoading) {
        return (
            <div className="max-w-3xl mx-auto p-8 space-y-6">
                {[1, 2].map(i => <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>)}
            </div>
        );
    }

    if (receipt) {
        const election = activeElections.find(e => e.id === receipt.electionId);
        return (
            <div className="max-w-2xl mx-auto p-8 text-center">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>

                    <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Vote Cast Successfully</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">
                        Your vote for <span className="font-bold">{election?.title}</span> has been securely recorded.
                    </p>

                    <div className="bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 mb-6">
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold mb-3">
                            Your Ballot Tracking Number
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <span className="text-xl md:text-2xl font-mono font-black text-indigo-600 dark:text-indigo-400 tracking-widest break-all">
                                {receipt.trackingNumber}
                            </span>
                            <button
                                onClick={() => copyToClipboard(receipt.trackingNumber)}
                                className="p-2 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-shrink-0"
                                title="Copy to clipboard"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mb-6 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Save this number! You will need it to verify your vote on the public ledger. It cannot be recovered.
                    </p>

                    <button
                        onClick={() => setReceipt(null)}
                        className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-bold hover:opacity-90 transition-opacity"
                    >
                        Return to Booth
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-4 space-y-8">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">Student Union Elections</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Your vote is anonymous and cryptographically secured.</p>
            </div>

            {activeElections.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400 text-lg">No active elections at this time.</p>
                </div>
            ) : (
                activeElections.map(election => (
                    <ElectionCard
                        key={election.id}
                        election={election}
                        candidates={candidates[election.id] || []}
                        hasVoted={hasVoted[election.id] || false}
                        selectedCandidate={selectedCandidates[election.id]}
                        onSelect={(candId) => handleSelect(election.id, candId)}
                        onSubmit={() => handleSubmit(election.id)}
                        isSubmitting={isSubmitting}
                    />
                ))
            )}
        </div>
    );
};

interface ElectionCardProps {
    election: Election;
    candidates: Candidate[];
    hasVoted: boolean;
    selectedCandidate: string | undefined;
    onSelect: (candidateId: string) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
}

const ElectionCard: React.FC<ElectionCardProps> = ({
    election, candidates, hasVoted, selectedCandidate, onSelect, onSubmit, isSubmitting
}) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/20">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{election.title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{election.description}</p>
            </div>

            <div className="p-6 space-y-4">
                {hasVoted ? (
                    <div className="text-center py-8 text-green-600 dark:text-green-400 font-bold flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        You have already cast your vote for this election.
                    </div>
                ) : (
                    <>
                        {candidates.map(candidate => (
                            <label
                                key={candidate.id}
                                className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedCandidate === candidate.id
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                            >
                                <div className="pt-1">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedCandidate === candidate.id ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300 dark:border-gray-600'
                                        }`}>
                                        {selectedCandidate === candidate.id && (
                                            <div className="w-2 h-2 bg-white rounded-full"></div>
                                        )}
                                    </div>
                                    <input
                                        type="radio"
                                        name={`election-${election.id}`}
                                        className="sr-only"
                                        checked={selectedCandidate === candidate.id}
                                        onChange={() => onSelect(candidate.id)}
                                    />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">{candidate.name}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                        {candidate.platform_summary}
                                    </p>
                                </div>
                            </label>
                        ))}

                        <button
                            onClick={onSubmit}
                            disabled={!selectedCandidate || isSubmitting}
                            className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-md transition-colors"
                        >
                            {isSubmitting ? 'Encrypting & Casting...' : 'Cast Secure Vote'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
