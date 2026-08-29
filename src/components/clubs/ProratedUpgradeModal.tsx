'use client';

import { useState } from 'react';
import { ProrationPreview } from '@/types/subscriptions';

interface ProratedUpgradeModalProps {
    clubId: string;
    newPriceId: string;
    currentTier: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ProratedUpgradeModal({ clubId, newPriceId, currentTier, onClose, onSuccess }: ProratedUpgradeModalProps) {
    const [preview, setPreview] = useState<ProrationPreview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useState(() => {
        async function fetchPreview() {
            try {
                const response = await fetch(`/api/clubs/${clubId}/subscriptions/preview-upgrade`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPriceId }),
                });
                const data = await response.json();
                if (response.ok) {
                    setPreview(data.preview);
                } else {
                    setError(data.error);
                }
            } catch (err) {
                setError('Failed to load pricing preview');
            } finally {
                setIsLoading(false);
            }
        }
        fetchPreview();
    });

    const handleUpgrade = async () => {
        if (!preview) return;
        setIsUpgrading(true);
        setError(null);

        try {
            const response = await fetch(`/api/clubs/${clubId}/subscriptions/upgrade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    newPriceId,
                    previewInvoiceId: preview.invoiceId,
                }),
            });

            const data = await response.json();
            if (response.ok) {
                onSuccess();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to process upgrade');
        } finally {
            setIsUpgrading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-8 border border-gray-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Upgrade to Premium
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Review your prorated upgrade details below. You will only be charged the difference for the remainder of your billing cycle.
                </p>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : error ? (
                    <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-center">
                        {error}
                    </div>
                ) : preview ? (
                    <div className="space-y-4 mb-6">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Current Tier ({currentTier})</span>
                            <span className="font-medium text-gray-900 dark:text-white">${preview.currentAmount}/mo</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">New Tier (Premium)</span>
                            <span className="font-medium text-gray-900 dark:text-white">${preview.newAmount}/mo</span>
                        </div>
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-green-600 dark:text-green-400">Prorated Credit</span>
                                <span className="font-medium text-green-600 dark:text-green-400">-${preview.proratedCredit.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Prorated Charge</span>
                                <span className="font-medium text-gray-900 dark:text-white">${preview.proratedCharge.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-blue-900 dark:text-blue-100">Due Today</span>
                                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">${preview.netDueToday.toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                Next full billing of ${preview.newAmount} on {preview.nextBillingDate}
                            </p>
                        </div>
                    </div>
                ) : null}

                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        disabled={isUpgrading}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpgrade}
                        disabled={isLoading || isUpgrading || !!error}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg shadow-md transition-colors disabled:opacity-50"
                    >
                        {isUpgrading ? 'Processing...' : `Confirm Upgrade ($${preview?.netDueToday.toFixed(2)})`}
                    </button>
                </div>
            </div>
        </div>
    );
}
