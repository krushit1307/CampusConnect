// =============================================================================
// Component: FiscalRolloverDashboard
// Issue: #4036 - Implement 'Automated Club Budget Roll-over' Logic
// Description: Admin dashboard to preview and manually trigger the fiscal 
// rollover process, displaying a detailed breakdown of reclaimed funds per club.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { calculateRolloverPreview, formatCurrency } from '../../../lib/finance/rolloverLogic';

interface ClubLedgerPreview {
    id: string;
    name: string;
    balance: number;
    initial_allocation: number;
    preview: ReturnType<typeof calculateRolloverPreview>;
}

export const FiscalRolloverDashboard: React.FC = () => {
    const [clubs, setClubs] = useState<ClubLedgerPreview[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadLedgers();
    }, []);

    const loadLedgers = async () => {
        setIsLoading(true);
        try {
            const { data: clubsData, error: clubErr } = await supabase
                .from('clubs')
                .select('id, name, ledger_balances(balance, initial_allocation)')
                .eq('is_active', true);

            if (clubErr) throw clubErr;

            const formatted = (clubsData || []).map((c: any) => {
                const ledger = c.ledger_balances || { balance: 0, initial_allocation: 0 };
                return {
                    id: c.id,
                    name: c.name,
                    balance: Number(ledger.balance || 0),
                    initial_allocation: Number(ledger.initial_allocation || 0),
                    preview: calculateRolloverPreview(
                        Number(ledger.balance || 0),
                        Number(ledger.initial_allocation || 0)
                    )
                };
            });
            setClubs(formatted);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const executeRollover = async () => {
        if (!confirm('Are you sure you want to execute the fiscal rollover? This will permanently debit club accounts.')) return;

        setIsProcessing(true);
        setError(null);
        try {
            const { data, error: fnErr } = await supabase.functions.invoke('execute-fiscal-rollover', {
                body: {}
            });
            if (fnErr) throw fnErr;
            if (data.error) throw new Error(data.error);

            setResult(data);
            await loadLedgers(); // Refresh to show new balances
        } catch (err: any) {
            setError(err.message || 'Failed to execute rollover.');
        } finally {
            setIsProcessing(false);
        }
    };

    const totalReclaimed = clubs.reduce((sum, c) => sum + c.preview.reclaimedAmount, 0);

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">Fiscal Year Rollover</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Reclaim excess funds exceeding 20% of initial allocation.
                    </p>
                </div>
                <button
                    onClick={executeRollover}
                    disabled={isProcessing || totalReclaimed === 0}
                    className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg flex items-center gap-2"
                >
                    {isProcessing ? (
                        <>
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                            Processing...
                        </>
                    ) : (
                        `Execute Rollover (${formatCurrency(totalReclaimed)})`
                    )}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl">
                    {error}
                </div>
            )}

            {result && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 rounded-xl">
                    <p className="font-bold">Success! Processed {result.processed_clubs} clubs. Total reclaimed: {formatCurrency(result.total_reclaimed)}</p>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                {['Club', 'Current Balance', 'Initial Allocation', 'Allowed Rollover (20%)', 'Reclaimed Amount', 'New Balance'].map(h => (
                                    <th key={h} className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {isLoading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading ledgers...</td></tr>
                            ) : clubs.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No active clubs found.</td></tr>
                            ) : (
                                clubs.map(club => (
                                    <tr key={club.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{club.name}</td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatCurrency(club.balance)}</td>
                                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatCurrency(club.initial_allocation)}</td>
                                        <td className="px-6 py-4 text-green-600 dark:text-green-400 font-medium">{formatCurrency(club.preview.allowedRollover)}</td>
                                        <td className="px-6 py-4 text-red-600 dark:text-red-400 font-bold">
                                            {club.preview.reclaimedAmount > 0 ? `-${formatCurrency(club.preview.reclaimedAmount)}` : '$0.00'}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(club.balance - club.preview.reclaimedAmount)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
