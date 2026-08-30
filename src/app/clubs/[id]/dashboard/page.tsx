'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Club } from '@/types/clubs';
import BudgetFrozenWarning from '@/components/finance/BudgetFrozenWarning';
import ProbationBanner from '@/components/clubs/ProbationBanner';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ClubDashboardPage() {
    const params = useParams();
    const clubId = params.id as string;
    const [club, setClub] = useState<Club | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchClub() {
            const { data, error } = await supabase
                .from('clubs')
                .select('*')
                .eq('id', clubId)
                .single();

            if (!error && data) {
                setClub(data);
            }
            setIsLoading(false);
        }
        fetchClub();
    }, [clubId]);

    if (isLoading || !club) {
        return <div className="min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Render the massive red banner if budget is frozen */}
            <BudgetFrozenWarning club={club} />

            {/* Render probation banner if applicable */}
            <ProbationBanner club={club} />

            <div className="max-w-7xl mx-auto p-8">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
                    {club.name} Dashboard
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Ledger Balance</h3>
                        <p className={`text-3xl font-bold ${club.ledger_balance < club.minimum_reserve ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            ${club.ledger_balance.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Minimum Reserve: ${club.minimum_reserve.toFixed(2)}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Financial Status</h3>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
              ${club.financial_status === 'frozen'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}
            `}>
                            {club.financial_status.toUpperCase()}
                        </span>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Club Status</h3>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
              ${club.status === 'probation' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}
            `}>
                            {club.status.toUpperCase()}
                        </span>
                    </div>
                </div>

                <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
                    <p className="text-gray-500 dark:text-gray-400">Activity feed will be displayed here.</p>
                </div>
            </div>
        </div>
    );
}
