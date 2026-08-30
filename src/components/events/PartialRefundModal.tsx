'use client';

import { useState } from 'react';
import { RefundType } from '@/types/refunds';

interface PartialRefundModalProps {
    eventId: string;
    totalRegistrants: number;
    onClose: () => void;
    onSuccess: () => void;
}

export default function PartialRefundModal({ eventId, totalRegistrants, onClose, onSuccess }: PartialRefundModalProps) {
    const [refundType, setRefundType] = useState<RefundType>('percentage');
    const [value, setValue] = useState<string>('');
    const [reason, setReason] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        setError(null);

        try {
            const response = await fetch(`/api/events/${eventId}/refund`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId,
                    refundType,
                    value: parseFloat(value),
                    reason: reason || 'Event cancellation proration',
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to process refunds');
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Issue Partial Refund
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    This will process prorated refunds for all {totalRegistrants} successful registrations. This action cannot be undone.
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Refund Type
                        </label>
                        <div className="flex space-x-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="refundType"
                                    value="percentage"
                                    checked={refundType === 'percentage'}
                                    onChange={() => setRefundType('percentage')}
                                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                                />
                                <span className="text-gray-700 dark:text-gray-300">Percentage (%)</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="refundType"
                                    value="flat_amount"
                                    checked={refundType === 'flat_amount'}
                                    onChange={() => setRefundType('flat_amount')}
                                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                                />
                                <span className="text-gray-700 dark:text-gray-300">Flat Amount ($)</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {refundType === 'percentage' ? 'Percentage to Refund (0-100)' : 'Amount to Refund in USD'}
                        </label>
                        <input
                            type="number"
                            step={refundType === 'percentage' ? '1' : '0.01'}
                            min="0"
                            max={refundType === 'percentage' ? '100' : undefined}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            required
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={refundType === 'percentage' ? 'e.g., 33' : 'e.g., 30.00'}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Reason for Refund (Internal Note)
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-24"
                            placeholder="e.g., Day 3 cancelled due to hurricane"
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isProcessing}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isProcessing || !value}
                            className="px-6 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white font-medium rounded-lg shadow-md transition-colors flex items-center space-x-2 disabled:opacity-50"
                        >
                            {isProcessing ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Processing Mass Refund...</span>
                                </>
                            ) : (
                                <span>Confirm & Issue Refunds</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
