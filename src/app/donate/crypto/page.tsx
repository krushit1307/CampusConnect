'use client';

import CryptoTaxCalculator from '@/components/donations/CryptoTaxCalculator';

export default function CryptoDonationPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
                        Donate Crypto, Maximize Impact
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                        Donating appreciated cryptocurrency directly to our club is one of the most tax-efficient ways to give.
                        Avoid capital gains taxes entirely and claim a full fair-market-value deduction.
                    </p>
                </div>

                <CryptoTaxCalculator />

                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2">Zero Capital Gains</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            By donating directly, you bypass the taxable event of selling your crypto for fiat.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2">Full Deduction</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Claim a charitable deduction for the full fair market value of the crypto on the date of the gift.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2">Secure & Compliant</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            All donations are processed via secure, audited smart contracts with immediate tax receipt generation.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
