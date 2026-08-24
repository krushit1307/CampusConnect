// =============================================================================
// Component: DonationImpactDashboard
// Issue: #3709 - Develop a 'Dynamic "Alumni Donation" Tracker'
// Description: The alum's personalized Impact Dashboard. Aggregates total
// giving and renders every donation as an impact card with photos + metrics.
// =============================================================================

import React from 'react';
import { useDonationImpact } from '../../hooks/useDonationImpact';
import { DonationImpactCard } from './DonationImpactCard';

export const DonationImpactDashboard: React.FC = () => {
    const { donations, totalGiven, isLoading, error } = useDonationImpact();

    if (isLoading) {
        return (
            <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map(i => <div key={i} className="h-72 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />)}
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">Your Impact</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        See exactly how your generosity shaped campus life.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                        ${totalGiven.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">
                        Total Given
                    </p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg">
                    {error}
                </div>
            )}

            {donations.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400">You haven't made any donations yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {donations.map(d => <DonationImpactCard key={d.id} donation={d} />)}
                </div>
            )}
        </div>
    );
};
