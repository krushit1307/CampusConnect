'use client';

import { useState } from 'react';

interface WeatherInsuranceOptInProps {
    eventId: string;
    totalBudget: number;
    onOptIn: (premium: number) => Promise<void>;
}

export default function WeatherInsuranceOptIn({ eventId, totalBudget, onOptIn }: WeatherInsuranceOptInProps) {
    const [isOptingIn, setIsOptingIn] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const premiumAmount = totalBudget * 0.02; // 2% of budget

    const handleOptIn = async () => {
        setIsOptingIn(true);
        setError(null);
        try {
            await onOptIn(premiumAmount);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to purchase insurance');
        } finally {
            setIsOptingIn(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-800 rounded-full">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        Decentralized Weather Insurance
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        Protect your event against sunken operational costs. If precipitation exceeds 1.0 inches at your venue's GPS coordinates,
                        a smart contract will <strong>instantly and autonomously</strong> payout your coverage amount without manual claims.
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-100 dark:border-blue-900">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Premium (2%)</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">${premiumAmount.toFixed(2)}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-100 dark:border-blue-900">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Coverage</p>
                            <p className="text-xl font-bold text-green-600 dark:text-green-400">${totalBudget.toFixed(2)}</p>
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
                    )}

                    <button
                        onClick={handleOptIn}
                        disabled={isOptingIn}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-xl shadow-md transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                        {isOptingIn ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Processing Blockchain Tx...</span>
                            </>
                        ) : (
                            <span>Opt-In to Weather Insurance</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
