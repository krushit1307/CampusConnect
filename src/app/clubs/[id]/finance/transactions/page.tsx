'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ClubTransaction } from '@/types/finance';
import { getPendingAuditTransactions, auditTransaction } from '@/lib/finance/anomalyDetection';
import TransactionAuditBadge from '@/components/finance/TransactionAuditBadge';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ClubTransactionsPage() {
    const params = useParams();
    const clubId = params.id as string;

    const [transactions, setTransactions] = useState<ClubTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchTransactions() {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('club_transactions')
                .select('*')
                .eq('club_id', clubId)
                .order('transaction_date', { ascending: false });

            if (!error && data) {
                setTransactions(data);
            }
            setIsLoading(false);
        }
        fetchTransactions();
    }, [clubId]);

    const handleAudit = async (txId: string) => {
        try {
            const result = await auditTransaction(txId);
            if (result.is_anomalous) {
                // Refresh transactions to show updated status
                const { data } = await supabase
                    .from('club_transactions')
                    .select('*')
                    .eq('club_id', clubId)
                    .order('transaction_date', { ascending: false });
                if (data) setTransactions(data);
            }
        } catch (error) {
            console.error('Audit failed:', error);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading transactions...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    Club Financial Transactions
                </h1>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Vendor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {transactions.map((tx) => (
                                <tr key={tx.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                        {new Date(tx.transaction_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                        {tx.vendor_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {tx.vendor_category}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                                        ${tx.amount.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${tx.status === 'pending_audit' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                                tx.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                                            {tx.status.replace('_', ' ').toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {tx.status !== 'pending_audit' && (
                                            <button
                                                onClick={() => handleAudit(tx.id)}
                                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                                            >
                                                Run Audit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Display audit badges for flagged transactions inline */}
                <div className="mt-8 space-y-4">
                    {transactions.filter(tx => tx.status === 'pending_audit').map(tx => (
                        <TransactionAuditBadge
                            key={tx.id}
                            status={tx.status}
                            reasons={tx.flagged_reasons}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
