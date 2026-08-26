// =============================================================================
// Component: ReinvestmentMetric
// Issue: #3277 - Implement 'Interactive Club Financial Transparency Dashboard'
// Description: Displays a prominent metric card showing the total funds the
// club has reinvested directly back into student events and activities.
// =============================================================================

import React from 'react';

interface ReinvestmentMetricProps {
    totalReinvested: number;
    totalBudget?: number; // Optional: To show a percentage if total budget is known
}

export const ReinvestmentMetric: React.FC<ReinvestmentMetricProps> = ({
    totalReinvested,
    totalBudget
}) => {

    const percentage = totalBudget && totalBudget > 0
        ? Math.round((totalReinvested / totalBudget) * 100)
        : null;

    return (
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <p className="text-green-100 text-sm font-medium uppercase tracking-wider">
                        Reinvested into Events
                    </p>
                </div>

                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black">
                        ${totalReinvested.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    {percentage !== null && (
                        <span className="text-lg font-bold text-green-200">
                            ({percentage}%)
                        </span>
                    )}
                </div>

                <p className="text-sm text-green-100 mt-2">
                    Directly funding student experiences this year.
                </p>
            </div>
        </div>
    );
};
