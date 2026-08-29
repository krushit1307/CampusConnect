'use client';

interface SuspiciousActivityAlertProps {
    studentName: string;
    reason: string;
    commitCount: number;
    linesChanged: number;
    onReview: () => void;
    onApprove: () => void;
}

export default function SuspiciousActivityAlert({
    studentName,
    reason,
    commitCount,
    linesChanged,
    onReview,
    onApprove
}: SuspiciousActivityAlertProps) {
    return (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-lg mb-4">
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                        Suspicious Activity: {studentName}
                    </h3>
                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                        <p>{reason}</p>
                        <div className="mt-2 flex space-x-4 text-xs font-mono bg-red-100 dark:bg-red-900/40 p-2 rounded">
                            <span>Commits: {commitCount}</span>
                            <span>Lines Changed: {linesChanged}</span>
                        </div>
                    </div>
                    <div className="mt-4 flex space-x-3">
                        <button
                            onClick={onReview}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 dark:text-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                            View Repository
                        </button>
                        <button
                            onClick={onApprove}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                            Override & Mark Attended
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
