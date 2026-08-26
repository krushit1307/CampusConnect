// =============================================================================
// Component: RiskScoreIndicator
//Issue: #3336 - Implement 'Automated Event Risk Assessment' Scoring
//Description: A small visual indicator shown to the Organizer in their
//dashboard if their event has been quarantined pending risk review.
// =============================================================================

import React from 'react';

interface RiskScoreIndicatorProps {
    status: string;
    riskScore: number;
}

export const RiskScoreIndicator: React.FC<RiskScoreIndicatorProps> = ({ status, riskScore }) => {
    if (status !== 'pending_risk_review') return null;

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-xs font-bold border border-amber-200 dark:border-amber-800">
            <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pending Safety Review (Score: {riskScore})
        </div>
    );
};
