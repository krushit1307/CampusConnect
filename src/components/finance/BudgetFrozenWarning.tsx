'use client';

import { Club } from '@/types/clubs';

interface BudgetFrozenWarningProps {
    club: Club;
}

export default function BudgetFrozenWarning({ club }: BudgetFrozenWarningProps) {
    if (club.financial_status !== 'frozen') {
        return null;
    }

    return (
        <div className="w-full bg-red-600 dark:bg-red-800 text-white p-6 shadow-lg border-b-4 border-red-800 dark:border-red-950">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start space-x-4">
                    <svg className="w-8 h-8 flex-shrink-0 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <h2 className="text-xl font-bold uppercase tracking-wide">
                            Club Budget Frozen
                        </h2>
                        <p className="mt-1 text-red-100">
                            Your club's ledger balance ($ {club.ledger_balance.toFixed(2)}) has dropped below the minimum reserve ($ {club.minimum_reserve.toFixed(2)}).
                        </p>
                        {club.frozen_reason && (
                            <p className="mt-1 text-sm text-red-200 font-medium">
                                Reason: {club.frozen_reason}
                            </p>
                        )}
                        <p className="mt-2 text-sm text-red-100">
                            You must deposit funds or generate ticket revenue before making purchases, signing vendor contracts, or booking resources.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
