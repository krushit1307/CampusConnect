'use client';

interface DropoutRiskBadgeProps {
    riskStatus: 'stable' | 'at_risk' | 'dropped';
    deltaTrend: 'improving' | 'neutral' | 'declining';
    avgDeltaMinutes: number;
}

export default function DropoutRiskBadge({ riskStatus, deltaTrend, avgDeltaMinutes }: DropoutRiskBadgeProps) {
    if (riskStatus === 'stable') {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Stable Engagement
            </span>
        );
    }

    if (riskStatus === 'at_risk') {
        return (
            <div className="flex flex-col items-start space-y-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 animate-pulse">
                    ⚠️ At Risk of Dropout
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    Trend: {deltaTrend} (Avg: {avgDeltaMinutes > 0 ? '+' : ''}{avgDeltaMinutes} mins)
                </span>
            </div>
        );
    }

    return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            Dropped
        </span>
    );
}
