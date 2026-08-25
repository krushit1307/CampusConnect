'use client';

import { TransactionStatus } from '@/types/finance';

interface TransactionAuditBadgeProps {
    status: TransactionStatus;
    reasons?: string[];
}

export default function TransactionAuditBadge({ status, reasons }: TransactionAuditBadgeProps) {
    if (status !== 'pending_audit') {
        return null;
    }

    return (
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm font-bold text-red-700 dark:text-red-300">
                    Flagged for Manual Review
                </span>
            </div>
            {reasons && reasons.length > 0 && (
                <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-400 space-y-1">
                    {reasons.map((reason, index) => (
                        <li key={index}>{reason}</li>
                    ))}
                </ul>
            )}
            <p className="mt-2 text-xs text-red-500 dark:text-red-400 italic">
                Club withdrawals are suspended until a Student Union Admin clears this flag.
            </p>
        </div>
    );
}
