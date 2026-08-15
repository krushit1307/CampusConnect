// =============================================================================
// Component: BallotLedger
// Issue: #3231 - Develop a 'Secure Digital Voting Ballot' for Student Union
// Description: The public verification portal. Allows anyone to paste a 
// tracking number and verify that their encrypted ballot was included in the 
// final tally, ensuring end-to-end verifiability without compromising anonymity.
// =============================================================================

import React, { useState } from 'react';
import { useElections } from '../../hooks/useElections';

export const BallotLedger: React.FC = () => {
    const { verifyBallot } = useElections();
    const [trackingNumber, setTrackingNumber] = useState('');
    const [result, setResult] = useState<any | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [notFound, setNotFound] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!trackingNumber.trim()) return;

        setIsSearching(true);
        setNotFound(false);
        setResult(null);

        const ballot = await verifyBallot(trackingNumber.trim());

        if (ballot) {
            setResult(ballot);
        } else {
            setNotFound(true);
        }

        setIsSearching(false);
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-8 text-center border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Public Ballot Ledger</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
                        Verify that your vote was counted. Enter your tracking number to see your encrypted ballot on the public ledger.
                    </p>
                </div>

                <form onSubmit={handleSearch} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Tracking Number
                        </label>
                        <input
                            type="text"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                            required
                        />
                    </div>

                    {notFound && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm text-center">
                            No ballot found with this tracking number. Note: Ballots may take up to 5 minutes to appear on the ledger due to security jitter.
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSearching}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-colors"
                    >
                        {isSearching ? 'Searching Ledger...' : 'Verify Ballot'}
                    </button>
                </form>

                {result && (
                    <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/10 space-y-4">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Ballot Verified on Ledger
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Tracking Number</p>
                                <p className="font-mono text-sm text-gray-900 dark:text-white break-all">{result.tracking_number}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Cast At</p>
                                <p className="text-sm text-gray-900 dark:text-white">{new Date(result.cast_at).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Encrypted Payload Hash</p>
                                <p className="font-mono text-xs text-gray-600 dark:text-gray-300 break-all bg-gray-50 dark:bg-gray-900 p-2 rounded">
                                    {result.encrypted_payload}
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center italic">
                            This cryptographic hash proves your specific vote was included in the final tally without revealing your identity.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
