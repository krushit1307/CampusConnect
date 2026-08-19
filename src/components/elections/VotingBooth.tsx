// =============================================================================
// Component: VotingBooth
// Issue: #3554 - Implement 'Secure Executive Board Election Voting with Anonymity'
// Description: The secure UI for club members to cast their ballot.Displays
// the candidates and their platforms.Once voted, the UI locks and shows a
// confirmation message, preventing double - voting.
//  =============================================================================

import React, { useState } from 'react';
import { useClubElections, ClubElection } from '../../hooks/useClubElections';

interface VotingBoothProps {
    clubId: string;
}

export const VotingBooth: React.FC<VotingBoothProps> = ({ clubId }) => {
    const { elections, hasVoted, isLoading, error, castVote } = useClubElections(clubId);
    const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

    const handleSelect = (electionId: string, candidateId: string) => {
        setSelectedCandidates(prev => ({ ...prev, [electionId]: candidateId }));
    };

    const handleSubmit = async (electionId: string) => {
        const candidateId = selectedCandidates[electionId];
        if (!candidateId) return;

        if (!confirm('Are you sure you want to cast your vote? This action is anonymous and cannot be changed.')) {
            return;
        }

        setIsSubmitting(electionId);
        await castVote(electionId, candidateId);
        setIsSubmitting(null);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                {[1, 2].map(i => <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse"></div>)}
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-center">
                {error}
            </div>
        );
    }

    const activeElections = elections.filter(e => e.status === 'active');

    if (activeElections.length === 0) {
        return (
            <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Active Elections</h3>
                <p className="text-gray-500 dark:text-gray-400">There are no open elections for this club at this time.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">Executive Board Elections</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Your vote is cryptographically anonymous. Organizers cannot trace your ballot.
                </p>
            </div>

            {activeElections.map(election => (
                <ElectionCard
                    key={election.id}
                    election={election}
                    hasVoted={hasVoted[election.id] || false}
                    selectedCandidate={selectedCandidates[election.id]}
                    onSelect={(candId) => handleSelect(election.id, candId)}
                    onSubmit={() => handleSubmit(election.id)}
                    isSubmitting={isSubmitting === election.id}
                />
            ))}
        </div>
    );
};

interface ElectionCardProps {
    election: ClubElection;
    hasVoted: boolean;
    selectedCandidate: string | undefined;
    onSelect: (candidateId: string) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
}

const ElectionCard: React.FC<ElectionCardProps> = ({
    election, hasVoted, selectedCandidate, onSelect, onSubmit, isSubmitting
}) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/20">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Election for: {election.position}
                </h2>
                {election.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{election.description}</p>
                )}
            </div>

            <div className="p-6 space-y-4">
                {hasVoted ? (
                    <div className="text-center py-8 text-green-600 dark:text-green-400 font-bold flex flex-col items-center gap-2">
                        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-lg">Your anonymous ballot has been cast.</span>
                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">Thank you for participating in club governance.</span>
                    </div>
                ) : (
                    <>
                        {election.candidates.map(candidate => (
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
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed whitespace-pre-wrap">
                                        {candidate.platform}
                                    </p>
                                </div>
                            </label>
                        ))}

                        <button
                            onClick={onSubmit}
                            disabled={!selectedCandidate || isSubmitting}
                            className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-md transition-colors"
                        >
                            {isSubmitting ? 'Casting Anonymous Ballot...' : 'Cast Secure Vote'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
