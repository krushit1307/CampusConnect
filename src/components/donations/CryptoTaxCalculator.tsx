'use client';

import { useState, useEffect } from 'react';
import { TaxCalculationInput, TaxCalculationResult, CryptoAsset } from '@/types/crypto';
import { calculateCryptoTaxBenefits, getCurrentCryptoPrices } from '@/lib/crypto/taxCalculator';

const AVAILABLE_ASSETS: CryptoAsset[] = [
    { symbol: 'BTC', name: 'Bitcoin', currentPrice: 65000 },
    { symbol: 'ETH', name: 'Ethereum', currentPrice: 3500 },
    { symbol: 'SOL', name: 'Solana', currentPrice: 150 },
];

export default function CryptoTaxCalculator() {
    const [prices, setPrices] = useState<Record<string, number>>({});
    const [selectedAsset, setSelectedAsset] = useState<string>('BTC');
    const [donationAmount, setDonationAmount] = useState<number>(10000);
    const [costBasis, setCostBasis] = useState<number>(30000); // e.g., bought BTC at $30k
    const [taxRate, setTaxRate] = useState<number>(0.20); // 20% capital gains

    const [result, setResult] = useState<TaxCalculationResult | null>(null);

    useEffect(() => {
        async function loadPrices() {
            const fetchedPrices = await getCurrentCryptoPrices();
            setPrices(fetchedPrices);
        }
        loadPrices();
    }, []);

    useEffect(() => {
        if (donationAmount > 0 && costBasis > 0) {
            const calcResult = calculateCryptoTaxBenefits({
                assetSymbol: selectedAsset,
                donationAmountUsd: donationAmount,
                costBasisPerCoin: costBasis,
                taxRate: taxRate,
            });
            setResult(calcResult);
        }
    }, [selectedAsset, donationAmount, costBasis, taxRate]);

    const currentPrice = prices[selectedAsset] || 0;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white">
                <h2 className="text-2xl font-bold mb-2">Crypto Tax Advantage Calculator</h2>
                <p className="text-blue-100 text-sm">
                    Maximize your philanthropic impact while minimizing your tax burden.
                </p>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Section */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Asset</label>
                        <select
                            value={selectedAsset}
                            onChange={(e) => setSelectedAsset(e.target.value)}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        >
                            {AVAILABLE_ASSETS.map(asset => (
                                <option key={asset.symbol} value={asset.symbol}>
                                    {asset.name} ({asset.symbol}) - ${prices[asset.symbol]?.toLocaleString() || '...'}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Donation Amount (USD)
                        </label>
                        <input
                            type="number"
                            value={donationAmount}
                            onChange={(e) => setDonationAmount(Number(e.target.value))}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Your Original Cost Basis (USD)
                        </label>
                        <input
                            type="number"
                            value={costBasis}
                            onChange={(e) => setCostBasis(Number(e.target.value))}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            What was the price per coin when you bought it?
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Estimated Tax Rate (%)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={taxRate * 100}
                            onChange={(e) => setTaxRate(Number(e.target.value) / 100)}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Results Section */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 flex flex-col justify-center">
                    {result && (
                        <div className="space-y-6">
                            <div className="text-center pb-6 border-b border-gray-200 dark:border-gray-700">
                                <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Financial Value to You</p>
                                <p className="text-5xl font-black text-green-600 dark:text-green-400">
                                    ${result.totalValueToDonor.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </p>
                                <p className="text-sm text-green-700 dark:text-green-300 mt-2 font-medium">
                                    Equivalent to a {result.effectiveBonusPercentage.toFixed(1)}% bonus on your donation!
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600 dark:text-gray-400">Coins Donated</span>
                                    <span className="font-bold text-gray-900 dark:text-white">{result.coinAmount.toFixed(6)} {selectedAsset}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600 dark:text-gray-400">Unrealized Gains Avoided</span>
                                    <span className="font-bold text-gray-900 dark:text-white">${result.unrealizedGains.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                    <span className="text-red-700 dark:text-red-300 font-medium">Capital Gains Tax Saved (20%)</span>
                                    <span className="font-bold text-red-600 dark:text-red-400">+${result.estimatedTaxLiability.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <span className="text-blue-700 dark:text-blue-300 font-medium">Tax Deduction Value</span>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">+${result.taxDeductionValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                            </div>

                            <button className="w-full py-4 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white font-bold text-lg rounded-xl shadow-md transition-colors mt-4">
                                Proceed with Crypto Donation
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
