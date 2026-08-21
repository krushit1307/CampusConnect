// =============================================================================
// Component: MergeConfirmationModal
//  Issue: #3560 - Implement 'Automated User Account Merger'
//  Description: The final confirmation step before executing the account merge.
//  Displays a severe warning about data loss and requires the user to type
//  "MERGE" to proceed with the atomic transaction.
// =============================================================================

import React, { useState } from 'react';
import { useAccountMerger } from '../../hooks/useAccountMerger';

interface MergeConfirmationModalProps {
    secondaryEmail: string;
    secondaryUserId: string;
    onClose: () => void;
}

export const MergeConfirmationModal: React.FC<MergeConfirmationModalProps> = ({
    secondaryEmail,
    secondaryUserId,
    onClose
}) => {
    const { isMerging, error, executeMerge } = useAccountMerger();
    const [confirmationText, setConfirmationText] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    const handleMerge = async () => {
        if (confirmationText !== 'MERGE') return;

        const success = await executeMerge(secondaryUserId);
        if (success) {
            setIsSuccess(true);
            // Redirect to home page after 3 seconds to refresh user state
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        }
    };

    if (isSuccess) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center border border-green-200 dark:border-green-800">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Accounts Merged Successfully!</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Your data has been transferred. You will be redirected to the homepage momentarily.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-red-200 dark:border-red-800">
                {/* Header */}
                <div className="p-6 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                    <h3 className="text-lg font-bold text-red-900 dark:text-red-200 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Confirm Account Merge
                    </h3>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                            You are about to merge the following account into your current profile:
                        </p>
                        <p className="font-bold text-gray-900 dark:text-white text-lg">
                            {secondaryEmail}
                        </p>
                    </div>

                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-2">⚠️ Warning:</h4>
                        <ul className="list-disc list-inside space-y-1 text-xs text-amber-800 dark:text-amber-300">
                            <li>All RSVPs, points, and memberships will be transferred.</li>
                            <li>Duplicate records will be automatically dropped.</li>
                            <li>The account <span className="font-bold">{secondaryEmail}</span> will be <span className="font-bold text-red-600">permanently deleted</span>.</li>
                            <li>This action cannot be undone.</li>
                        </ul>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Type <span className="text-red-600 font-mono">MERGE</span> to confirm:
                        </label>
                        <input
                            type="text"
                            value={confirmationText}
                            onChange={(e) => setConfirmationText(e.target.value.toUpperCase())}
                            placeholder="MERGE"
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 font-mono tracking-widest text-center text-lg"
                            disabled={isMerging}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isMerging}
                        className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleMerge}
                        disabled={isMerging || confirmationText !== 'MERGE'}
                        className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-sm"
                    >
                        {isMerging ? 'Merging Accounts...' : 'Permanently Merge'}
                    </button>
                </div>
            </div>
        </div>
    );
};
