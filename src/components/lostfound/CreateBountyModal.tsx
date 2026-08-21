// =============================================================================
// Component: CreateBountyModal
// Issue: #3318 - Implement 'Interactive Lost Item Bounty' System
// Description: Modal for the item owner to set a monetary reward.Explains
// the escrow process and initiates the Stripe Checkout session.
// =============================================================================

import React, { useState } from 'react';
import { useLostItemBounties } from '../../hooks/useLostItemBounties';

interface CreateBountyModalProps {
    lostItemId: string;
    itemTitle: string;
    onClose: () => void;
}

export const CreateBountyModal: React.FC<CreateBountyModalProps> = ({
    lostItemId,
    itemTitle,
    onClose
}) => {
    const { createBounty, isCreatingEscrow, error } = useLostItemBounties();
    const [amount, setAmount] = useState('20');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 1) return;

        await createBounty(lostItemId, numAmount);
        // Note: createBounty redirects to Stripe, so we don't close the modal manually
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
                    <h3 className="text-xl font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Add Cash Bounty
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Incentivize the finder with a secure monetary reward for: <span className="font-bold">{itemTitle}</span>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
                        <p className="font-bold mb-1">How Escrow Works:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Your card is charged immediately.</li>
                            <li>Funds are held securely by CampusConnect.</li>
                            <li>When you confirm the item is returned, funds are released to the finder.</li>
                            <li>If the item is never found, you can request a full refund.</li>
                        </ul>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Reward Amount (USD)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-bold text-lg">$</span>
                            <input
                                type="number"
                                step="1"
                                min="1"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 text-2xl font-black"
                                required
                            />
                        </div>
                        <div className="flex gap-2 mt-2">
                            {[10, 20, 50, 100].map(val => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setAmount(val.toString())}
                                    className="flex-1 py-1 text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    ${val}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} disabled={isCreatingEscrow} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 font-medium">
                            Cancel
                        </button>
                        <button type="submit" disabled={isCreatingEscrow} className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-bold shadow-md">
                            {isCreatingEscrow ? 'Redirecting to Stripe...' : `Fund $${amount} Escrow`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
