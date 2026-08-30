'use client';

import { useState } from 'react';
import { SLACalculationResult } from '@/types/vendors';

interface SLAScannerProps {
    milestoneId: string;
    vendorId: string;
    clubId: string;
    deadline: string;
    totalAmount: number;
    onScanComplete: (result: SLACalculationResult) => void;
}

export default function SLAScanner({ milestoneId, vendorId, clubId, deadline, totalAmount, onScanComplete }: SLAScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSimulateScan = async () => {
        setIsScanning(true);
        setError(null);

        try {
            const response = await fetch(`/api/vendors/${milestoneId}/check-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    milestoneId,
                    vendorId,
                    qrCodeData: `VENUE_${clubId}`,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Check-in failed');
            }

            onScanComplete(data.slaResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700 max-w-md w-full mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">Vendor Arrival Check-In</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                Scan the venue QR code to log your arrival time. <br />
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Deadline: {new Date(deadline).toLocaleString()}</span>
            </p>

            {error && (
                <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-center">
                    {error}
                </div>
            )}

            <div className="bg-gray-100 dark:bg-gray-900 p-8 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 mb-6 flex flex-col items-center justify-center">
                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Camera feed would activate here</p>
                <button
                    onClick={handleSimulateScan}
                    disabled={isScanning}
                    className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-xl shadow-md transition-colors disabled:opacity-50"
                >
                    {isScanning ? 'Processing...' : 'Simulate QR Scan'}
                </button>
            </div>

            <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Total Milestone Value: <span className="font-bold text-gray-900 dark:text-white">${totalAmount.toFixed(2)}</span>
                </p>
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                    * Late arrivals incur a 5% penalty per 15 minutes, capped at 50%.
                </p>
            </div>
        </div>
    );
}
