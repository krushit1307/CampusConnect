// =============================================================================
// Component: TransparencyDashboard
// Issue: #3277 - Implement 'Interactive Club Financial Transparency Dashboard'
// Description: The main public-facing dashboard for club finances. Combines 
// the Spending Donut Chart and Reinvestment Metric. Handles privacy toggles 
// and displays appropriate empty states if the club hides their financials.
// =============================================================================

import React from 'react';
import { useClubFinances } from '../../hooks/useClubFinances';
import { SpendingDonutChart } from './SpendingDonutChart';
import { ReinvestmentMetric } from './ReinvestmentMetric';

interface TransparencyDashboardProps {
    clubId: string;
    clubName: string;
    isTreasurer?: boolean;
}

export const TransparencyDashboard: React.FC<TransparencyDashboardProps> = ({
    clubId,
    clubName,
    isTreasurer = false
}) => {
    const { breakdown, totalReinvested, isLoading, error, isTransparent } = useClubFinances(clubId);

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-center">
                <p className="font-bold mb-1">Failed to load financial data</p>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    if (!isTransparent && !isTreasurer) {
        return (
            <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Financials are Private</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    The {clubName} executive board has chosen to keep their detailed spending breakdown private.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">Financial Transparency</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        How {clubName} is allocating funds this academic year.
                    </p>
                </div>
                {isTreasurer && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full font-medium">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Public View
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                    <ReinvestmentMetric totalReinvested={totalReinvested} />
                </div>

                <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Spending Breakdown</h3>
                    <SpendingDonutChart data={breakdown} />
                </div>
            </div>

            {/* Detailed List (Fallback for accessibility and screen readers) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider">
                        Category Details
                    </h3>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {breakdown.map((item) => (
                        <div key={item.category} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">{item.category}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{item.transaction_count} transactions</p>
                            </div>
                            <p className="font-bold text-gray-900 dark:text-white">
                                ${item.total_spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
