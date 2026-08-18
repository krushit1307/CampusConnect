// =============================================================================
// Component: ReceiptScannerUploader
// Issue: #3545 - Implement 'Automated Post-Event Expense Reconciliation'
// Description: Drag - and - drop upload zone for Treasurers to submit crumpled
// receipts.Displays a live preview, processing state, and the extracted
// vendor / amount once the Vision AI completes its analysis.
// =============================================================================

import React, { useState, useRef } from 'react';
import { useExpenseReconciliation, ReconciliationResult } from '../../hooks/useExpenseReconciliation';

interface ReceiptScannerUploaderProps {
    expenseId: string;
    clubId: string;
    approvedBudgetCents: number;
    onScanComplete: (result: ReconciliationResult) => void;
}

export const ReceiptScannerUploader: React.FC<ReceiptScannerUploaderProps> = ({
    expenseId,
    clubId,
    approvedBudgetCents,
    onScanComplete
}) => {
    const { isUploading, isScanning, error, uploadAndScan } = useExpenseReconciliation();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file (JPG, PNG).');
            return;
        }

        setPreviewUrl(URL.createObjectURL(file));
        const result = await uploadAndScan(expenseId, clubId, file, approvedBudgetCents);
        if (result) {
            onScanComplete(result);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const isProcessing = isUploading || isScanning;

    return (
        <div className="space-y-4">
            <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${dragActive
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-gray-50 dark:bg-gray-900/50'
                    } ${isProcessing ? 'pointer-events-none opacity-70' : ''}`}
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    capture="environment" // Opens camera on mobile
                    className="hidden"
                    onChange={handleChange}
                    disabled={isProcessing}
                />

                {previewUrl ? (
                    <div className="flex flex-col items-center gap-4">
                        <img src={previewUrl} alt="Receipt Preview" className="max-h-48 rounded-lg shadow-md object-contain" />
                        {isProcessing && (
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium">
                                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {isUploading ? 'Uploading receipt...' : 'Scanning with Vision AI...'}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="text-gray-600 dark:text-gray-400">
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold">Click to upload</span> or drag and drop
                        </div>
                        <p className="text-xs text-gray-500">Take a photo of your receipt or upload an image (PNG, JPG)</p>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                    {error}
                </div>
            )}
        </div>
    );
};
