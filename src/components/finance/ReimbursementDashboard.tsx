// =============================================================================
// Component: ReimbursementDashboard
// Issue: #3227 - Implement 'Automated Reimbursement Processing' via Stripe
// Description: The main portal for Club Treasurers and Members to manage 
// expense claims. Displays a list of requests with their approval status, 
// allows executives to approve/reject, and triggers Stripe payouts.
// =============================================================================

import React, { useState } from 'react';
import { useReimbursements, Reimbursement } from '../../hooks/useReimbursements';
import { SubmitReimbursementModal } from './SubmitReimbursementModal';
import { StripeConnectButton } from './StripeConnectButton';

interface ReimbursementDashboardProps {
    clubId: string;
    userId: string;
    userRole: 'member' | 'treasurer' | 'president' | 'admin';
}

export const ReimbursementDashboard: React.FC<ReimbursementDashboardProps> = ({ clubId, userId, userRole }) => {
    const { reimbursements, isLoading, approveReimbursement, rejectReimbursement, triggerPayout } = useReimbursements(clubId);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const isExecutive = ['treasurer', 'president', 'admin'].includes(userRole);

    const handleApprove = async (id: string) => {
        setProcessingId(id);
        const role = userRole === 'treasurer' || userRole === 'admin' ? 'treasurer' : 'president';
        await approveReimbursement(id, role);
        setProcessingId(null);
    };

    const handleReject = async (id: string) => {
        if (!confirm('Are you sure you want to reject this reimbursement?')) return;
        setProcessingId(id);
        await rejectReimbursement(id);
        setProcessingId(null);
    };

    const handlePayout = async (id: string) => {
        if (!confirm('Confirm transfer of funds via Stripe? This action cannot be undone.')) return;
        setProcessingId(id);
        await triggerPayout(id);
        setProcessingId(null);
    };

    const getStatusBadge = (status: Reimbursement['status']) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400';
            case 'approved_treasurer': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400';
            case 'approved_dual': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400';
            case 'processing': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400';
            case 'paid': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400';
            case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">Expense Reimbursements</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Submit receipts and track club payouts.</p>
                </div>

                <div className="flex items-center gap-4">
                    <StripeConnectButton userId={userId} />
                    <button
                        onClick={() => setShowSubmitModal(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2 shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        New Request
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>)}
                </div>
            ) : reimbursements.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                    </svg>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Reimbursements Found</h3>
                    <p className="text-gray-500 dark:text-gray-400">Submit your first expense claim to get started.</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Requester</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                {isExecutive && <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {reimbursements.map(req => (
                                <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                                                {req.profiles?.full_name?.charAt(0) || '?'}
                                            </div>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {req.profiles?.full_name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-gray-900 dark:text-white font-medium truncate max-w-xs">{req.description}</p>
                                        <a href={req.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                                            View Receipt →
                                        </a>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900 dark:text-white">
                                        ${(req.amount_cents / 100).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-2 py-1 text-xs font-bold rounded-full uppercase ${getStatusBadge(req.status)}`}>
                                            {req.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    {isExecutive && (
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                            {req.status === 'pending' && userRole === 'treasurer' && (
                                                <button onClick={() => handleApprove(req.id)} disabled={processingId === req.id} className="text-blue-600 hover:text-blue-900 disabled:opacity-50">Approve</button>
                                            )}
                                            {req.status === 'pending' && req.treasurer_approval_id && userRole === 'president' && req.amount_cents > 10000 && (
                                                <button onClick={() => handleApprove(req.id)} disabled={processingId === req.id} className="text-blue-600 hover:text-blue-900 disabled:opacity-50">Co-Approve</button>
                                            )}
                                            {(req.status === 'approved_treasurer' || req.status === 'approved_dual') && (
                                                <button onClick={() => handlePayout(req.id)} disabled={processingId === req.id} className="text-green-600 hover:text-green-900 font-bold disabled:opacity-50">Send Payout</button>
                                            )}
                                            {(req.status === 'pending' || req.status === 'approved_treasurer') && (
                                                <button onClick={() => handleReject(req.id)} disabled={processingId === req.id} className="text-red-600 hover:text-red-900 disabled:opacity-50">Reject</button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showSubmitModal && (
                <SubmitReimbursementModal clubId={clubId} onClose={() => setShowSubmitModal(false)} />
            )}
        </div>
    );
};
