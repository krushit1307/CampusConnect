// =============================================================================
// Component: ReleaseFundsModal
//  Issue: #3318 - Implement 'Interactive Lost Item Bounty' System
//  Description: Confirmation modal for the item owner to release the escrowed 
//  funds to the finder. Requires explicit confirmation to prevent accidental payouts.
// =============================================================================

import React, { useState } from 'react';
import { useLostItemBounties } from '../../hooks/useLostItemBounties';

interface ReleaseFundsModalProps {
    lostItemId: string;
    bountyAmountCents: number;
    finderName: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const ReleaseFundsModal: React.FC<ReleaseFundsModalProps> = ({
    lostItemId,
    bountyAmountCents,
    finderName,
    onClose,
    onSuccess
}) => {
    const { releaseFunds, isReleasing, error } = useLostItemBounties();
    const [confirmed, setConfirmed] = useState(false);

    const amountDollars = (bountyAmountCents / 100).toFixed(2);
    const platformFee = (bountyAmountCents * 0.05 / 100).toFixed(2);
    const netPayout = ((bountyAmountCents - (bountyAmountCents * 0.05)) / 100).toFixed(2);

    const handleRelease = async () => {
        const success = await releaseFunds(lostItemId);
        if (success) {
            onSuccess();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Release Bounty Funds</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Confirm that <span className="font-bold text-gray-900 dark:text-white">{finderName}</span> has successfully returned your item.
                    </p>
                </div>

                <div className="p-6 space-y-5">
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Total Bounty</span>
                            <span className="font-bold text-gray-900 dark:text-white">${amountDollars}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Platform Fee (5%)</span>
                            <span className="text-red-600 dark:text-red-400">-${platformFee}</span>
                        </div>
                        <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-gray-900 dark:text-white">Finder Receives</span>
                            <span className="text-green-600 dark:text-green-400">${netPayout}</span>
                        </div>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(e) => setConfirmed(e.target.checked)}
                            className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            I have physically received my item back in good condition. I authorize CampusConnect to release the escrowed funds to the finder. <span className="text-red-600 dark:text-red-400 font-bold">This action cannot be undone.</span>
                        </span>
                    </label>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} disabled={isReleasing} className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 font-medium">
                            Cancel
                        </button>
                        <button
                            onClick={handleRelease}
                            disabled={!confirmed || isReleasing}
                            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-md"
                        >
                            {isReleasing ? 'Processing Transfer...' : 'Release Funds'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
