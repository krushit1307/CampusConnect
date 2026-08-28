'use client';

import { useState } from 'react';
import { IRS990NPayload } from '@/types/tax';

interface IRS990NGeneratorProps {
    clubId: string;
}

export default function IRS990NGenerator({ clubId }: IRS990NGeneratorProps) {
    const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear() - 1);
    const [isLoading, setIsLoading] = useState(false);
    const [payload, setPayload] = useState<IRS990NPayload | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setPayload(null);

        try {
            const response = await fetch(`/api/clubs/${clubId}/tax/generate-990n`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fiscalYear }),
            });

            const data = await response.json();
            if (response.ok) {
                setPayload(data.payload);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to generate tax form data');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (payload) {
            navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
            alert('Payload copied to clipboard!');
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                IRS Form 990-N (e-Postcard) Generator
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                Automatically map your ledger data to the IRS 990-N schema. This tool is only for clubs with gross receipts ≤ $50,000.
            </p>

            <div className="flex items-end space-x-4 mb-6">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fiscal Year
                    </label>
                    <input
                        type="number"
                        value={fiscalYear}
                        onChange={(e) => setFiscalYear(parseInt(e.target.value))}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                    {isLoading ? 'Generating...' : 'Generate Payload'}
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
                    {error}
                </div>
            )}

            {payload && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-gray-900 dark:text-white">Generated 990-N Schema</h4>
                        <button
                            onClick={copyToClipboard}
                            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                        >
                            Copy JSON
                        </button>
                    </div>
                    <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-sm font-mono">
                        {JSON.stringify(payload, null, 2)}
                    </pre>
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>Instructions:</strong> Copy the JSON payload above and use it to fill out the official IRS e-Postcard website, or provide it to your tax professional for direct upload.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
