'use client';

interface ChurnRiskBadgeProps {
    score: number;
    level: 'low' | 'medium' | 'high';
    signals: string[];
}

export default function ChurnRiskBadge({ score, level, signals }: ChurnRiskBadgeProps) {
    const getStyles = () => {
        switch (level) {
            case 'high':
                return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800';
            case 'medium':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
            default:
                return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800';
        }
    };

    return (
        <div className={`inline-flex flex-col p-3 rounded-lg border ${getStyles()}`}>
            <div className="flex items-center space-x-2 mb-1">
                <span className="text-2xl font-bold">{score}</span>
                <span className="text-xs font-semibold uppercase tracking-wider">Risk Score</span>
            </div>
            <div className="text-xs font-medium mb-2">
                {level === 'high' ? '🚨 High Risk' : level === 'medium' ? '⚠️ Medium Risk' : '✅ Low Risk'}
            </div>
            {signals.length > 0 && (
                <ul className="text-xs space-y-1 opacity-90">
                    {signals.slice(0, 2).map((signal, idx) => (
                        <li key={idx} className="flex items-start">
                            <span className="mr-1">•</span>
                            <span>{signal}</span>
                        </li>
                    ))}
                    {signals.length > 2 && <li>+{signals.length - 2} more</li>}
                </ul>
            )}
        </div>
    );
}
