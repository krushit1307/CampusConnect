// =============================================================================
// Component: ElectionResults
// Issue: #3554 - Implement 'Secure Executive Board Election Voting with Anonymity'
// Description: Displays the live tally of anonymous ballots.Renders a bar
// chart showing the vote count and percentage for each candidate.
//  =============================================================================

import React, { useState, useEffect } from 'react';
import { useClubElections, ElectionResults as ResultsType } from '../../hooks/useClubElections';

interface ElectionResultsProps {
    electionId: string;
    position: string;
}

export const ElectionResults: React.FC<ElectionResultsProps> = ({ electionId, position }) => {
    const { fetchResults } = useClubElections(null); // Hook used just for the fetch function
    const [results, setResults] = useState<ResultsType[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const data = await fetchResults(electionId);
            setResults(data);
            setIsLoading(false);
        };
        load();
    }, [electionId]);

    const totalVotes = results.reduce((sum, r) => sum + r.vote_count, 0);

    if (isLoading) {
        return <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>;
    }

    if (totalVotes === 0) {
        return (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No votes have been cast yet.
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Live Results: {position}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Total Anonymous Ballots Cast: <span className="font-bold text-gray-900 dark:text-white">{totalVotes}</span>
            </p>

            <div className="space-y-4">
                {results.map((result, idx) => (
                    <div key={result.candidate_name}>
                        <div className="flex justify-between items-baseline mb-1">
                            <span className="font-medium text-gray-900 dark:text-white text-sm">
                                {idx === 0 && <span className="text-yellow-500 mr-1">👑</span>}
                                {result.candidate_name}
                            </span>
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                {result.vote_count} votes ({result.percentage}%)
                            </span>
                        </div>
                        <div className="w-full h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${idx === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 'bg-indigo-600'
                                    }`}
                                style={{ width: `${result.percentage}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
