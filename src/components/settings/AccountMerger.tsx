// =============================================================================
// Component: AccountMerger
//  Issue: #3560 - Implement 'Automated User Account Merger'
//  Description: The Settings UI for users to link and merge another account.
//  Guides them through the OAuth flow and displays a summary of what will
//  be transferred before executing the final merge.
// =============================================================================

import React, { useState } from 'react';
import { useAccountMerger } from '../../hooks/useAccountMerger';
import { MergeConfirmationModal } from './MergeConfirmationModal';

export const AccountMerger: React.FC = () => {
    const { isAuthenticating, error, initiateOAuth } = useAccountMerger();
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [secondaryUserId, setSecondaryUserId] = useState<string | null>(null);
    const [secondaryEmail, setSecondaryEmail] = useState<string | null>(null);

    // Mock function to simulate the callback from the OAuth flow
    // In a real app, this would be handled by the /settings/merge-callback route
    const handleOAuthCallback = () => {
        // Simulate receiving the secondary user's ID and email from the callback
        setSecondaryUserId('mock-secondary-user-id-12345');
        setSecondaryEmail('old.account@gmail.com');
        setShowConfirmation(true);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Merge Accounts
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Have multiple accounts? Link your old account to transfer your RSVP history, gamification points, and club memberships to your current profile.
            </p>

            {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-2">How it works:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-blue-800 dark:text-blue-300">
                        <li>Click "Link Another Account" to authenticate your old profile.</li>
                        <li>Review the data that will be transferred.</li>
                        <li>Confirm the merge. Your old account will be permanently deleted.</li>
                    </ol>
                </div>

                <button
                    onClick={() => {
                        // In a real app, this calls initiateOAuth()
                        // For this demo, we simulate the successful callback
                        handleOAuthCallback();
                    }}
                    disabled={isAuthenticating}
                    className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-bold text-sm flex items-center justify-center gap-2 shadow-sm"
                >
                    {isAuthenticating ? (
                        <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Authenticating...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.937,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032 s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2 C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
                            </svg>
                            Link Another Account (Google)
                        </>
                    )}
                </button>
            </div>

            {showConfirmation && secondaryUserId && secondaryEmail && (
                <MergeConfirmationModal
                    secondaryEmail={secondaryEmail}
                    secondaryUserId={secondaryUserId}
                    onClose={() => setShowConfirmation(false)}
                />
            )}
        </div>
    );
};
