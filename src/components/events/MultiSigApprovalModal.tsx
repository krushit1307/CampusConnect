'use client';

import { useState } from 'react';
import { Event } from '@/types/events';
import { useAuth } from '@/lib/auth';

interface MultiSigApprovalModalProps {
    event: Event;
    onClose: () => void;
    onSuccess: () => void;
}

export default function MultiSigApprovalModal({ event, onClose, onSuccess }: MultiSigApprovalModalProps) {
    const { user } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleApproveCancellation = async () => {
        if (!user) return;
        setIsProcessing(true);
        setError(null);

        try {
            const response = await fetch(`/api/events/${event.id}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: event.id,
                    adminId: user.id,
                    action: 'cancel',
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to process approval');
            }

            if (data.requiresMultiSig) {
                setSuccessMessage(data.message);
            } else {
                setSuccessMessage('Event successfully cancelled.');
                setTimeout(onSuccess, 1500);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsProcessing(false);
        }
    };

    const approvedCount = (event.cancellation_approved_by || []).length;
    const hasApproved = event.cancellation_approved_by?.includes(user?.id || '');

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-8 border border-red-200 dark:border-red-800">
                <div className="flex items-center space-x-3 mb-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                        <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Approve Event Cancellation</h3>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    You are about to approve the cancellation of <strong>{event.title}</strong>.
                    Because your club has multiple administrators, this action requires multi-signature approval to prevent accidental or malicious cancellations.
                </p>

                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg mb-6 border border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Approval Status:</p>
                    <div className="flex items-center space-x-2">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-500"
                                style={{ width: `${(approvedCount / 2) * 100}%` }}
                            />
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{approvedCount}/2</span>
                    </div>
                    {hasApproved && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-2">✓ You have already approved this action.</p>
                    )}
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300 text-sm">
                        {successMessage}
                    </div>
                )}

                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleApproveCancellation}
                        disabled={isProcessing || hasApproved || !!successMessage}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white font-medium rounded-lg shadow-md transition-colors disabled:opacity-50"
                    >
                        {isProcessing ? 'Processing...' : hasApproved ? 'Already Approved' : 'Approve Cancellation'}
                    </button>
                </div>
            </div>
        </div>
    );
}
