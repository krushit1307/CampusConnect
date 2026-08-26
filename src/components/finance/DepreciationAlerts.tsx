// =============================================================================
// Component: DepreciationAlerts
// Issue: #3685 - Implement 'Automated "Event Equipment" Depreciation Tracker'
// Description: Replacement-budget alert banners for assets whose book value
// has fallen below 20% of their original purchase price.
// =============================================================================

import React from 'react';

interface DepreciationAlertsProps {
    alerts: { name: string; message: string }[];
}

export const DepreciationAlerts: React.FC<DepreciationAlertsProps> = ({ alerts }) => {
    if (alerts.length === 0) return null;

    return (
        <div className="space-y-3">
            {alerts.map(alert => (
                <div
                    key={alert.name}
                    className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-r-lg"
                >
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">End-of-Life Alert</p>
                        <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">{alert.message}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};
