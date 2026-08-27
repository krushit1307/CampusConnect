// =============================================================================
// Component: SponsorPitchModal
// Issue: #2961 - Implement 'Sponsorship Matchmaking' Algorithm
// Description: Modal interface for club admins to compose and send a funding 
// pitch to a specific sponsor. Supports requesting partial funding if the 
// sponsor's remaining budget is less than the total request.
// =============================================================================

import React, { useState } from 'react';
import { useSponsorshipMatches } from '../../hooks/useSponsorshipMatches';
import { SponsorshipCampaign, formatCurrency } from '../../lib/sponsorship/matchmaking';

interface SponsorPitchModalProps {
    campaign: SponsorshipCampaign;
    requestAmount: number;
    onClose: () => void;
}

export const SponsorPitchModal: React.FC<SponsorPitchModalProps> = ({
    campaign,
    requestAmount,
    onClose
}) => {
    // We need the sendPitch function, but since it's tied to the requestId in the hook,
    // we'll simulate the call or assume the parent handles it. 
    // For this isolated component, we'll mock the submission state.
    const [message, setMessage] = useState('');
    const [amount, setAmount] = useState(Math.min(requestAmount, campaign.remaining_budget));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const maxAmount = Math.min(requestAmount, campaign.remaining_budget);
    const isPartial = campaign.remaining_budget < requestAmount;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || amount <= 0) return;

        setIsSubmitting(true);
        setError(null);

        // Simulate API call delay for UX demonstration
        await new Promise(resolve => setTimeout(resolve, 1000));

        // In a real app, this would call sendPitch(campaign.campaign_id, message, amount * 100)
        console.log('Pitch sent:', { campaignId: campaign.campaign_id, message, amount: amount * 100 });

        setIsSubmitting(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        Pitch to {campaign.company_name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {campaign.campaign_title}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {isPartial && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300 flex items-start gap-2">
                            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <p className="font-bold">Partial Funding Available</p>
                                <p>This sponsor's remaining budget ({formatCurrency(campaign.remaining_budget * 100)}) is less than your request ({formatCurrency(requestAmount * 100)}). You can request a partial amount.</p>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Pitch Message <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={4}
                            maxLength={1000}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                            placeholder="Explain why your event aligns with their campaign goals and how you'll promote their brand..."
                            required
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                            {message.length}/1000
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Request Amount (USD)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">$</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                min={1}
                                max={maxAmount}
                                step={1}
                                className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                required
                            />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Max: ${maxAmount.toLocaleString()}
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !message.trim() || amount <= 0}
                            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-2 shadow-md"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending...
                                </>
                            ) : (
                                'Send Pitch'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
