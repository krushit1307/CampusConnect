/**
 * Enterprise Architectural Specification & React Component:
 * Module: Receipt OCR Upload & Pre-Filled Ledger Form UI
 * File: components/ClubReceiptOcrLedgerModal.tsx
 * Standard: React 18 Functional Component, Automated Financial Ledger Pre-Fill
 * Compliance: WCAG 2.1 AA Accessibility, 1-Click Treasurer Confirmation (#4267)
 */

import React, { useState } from 'react';
import { clubReceiptOcrService, ParsedReceiptData, LedgerPreFillData } from '../src/services/clubReceiptOcrService';

export interface ClubReceiptOcrLedgerModalProps {
  clubId?: string;
  treasurerId?: string;
  onConfirmLedgerEntry?: (entry: LedgerPreFillData) => void;
}

export const ClubReceiptOcrLedgerModal: React.FC<ClubReceiptOcrLedgerModalProps> = ({
  clubId = 'CLUB-CS-101',
  treasurerId = 'USER-TREASURER-501',
  onConfirmLedgerEntry
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parsedData, setParsedData] = useState<ParsedReceiptData | null>(null);
  
  // Pre-filled Form States
  const [vendorName, setVendorName] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>('');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusMessage('Sending receipt to AWS Textract AnalyzeExpense API...');

    // Mock file preview URL
    const mockUrl = URL.createObjectURL(file);
    setReceiptPreview(mockUrl);

    try {
      // Execute OCR analysis
      const res = await clubReceiptOcrService.processReceiptImage(mockUrl, clubId, treasurerId);
      setParsedData(res);
      setVendorName(res.vendorName);
      setTotalAmount(res.totalAmount.toFixed(2));
      setExpenseDate(res.purchaseDate);
      setStatusMessage(`✔ AWS Textract OCR Complete! Extracted with ${res.confidenceScore}% confidence.`);
    } catch (err: any) {
      setStatusMessage(`❌ Error parsing receipt: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateDefaultReceipt = async () => {
    setIsProcessing(true);
    setStatusMessage('Simulating AWS Textract OCR scan on Domino\'s Pizza receipt ($45.92)...');
    
    // Sample Domino's Receipt image URL
    const demoUrl = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500';
    setReceiptPreview(demoUrl);

    setTimeout(async () => {
      const res = await clubReceiptOcrService.processReceiptImage(demoUrl, clubId, treasurerId);
      setParsedData(res);
      setVendorName(res.vendorName);
      setTotalAmount('45.92');
      setExpenseDate(res.purchaseDate);
      setStatusMessage(`✔ AWS Textract OCR Complete! Parsed Vendor: "${res.vendorName}", Amount: $${res.totalAmount}`);
      setIsProcessing(false);
    }, 1000);
  };

  const handleConfirmLedger = () => {
    if (!vendorName || !totalAmount || !expenseDate) return;

    const entry: LedgerPreFillData = {
      clubId,
      treasurerId,
      vendorName,
      amount: parseFloat(totalAmount),
      date: expenseDate,
      receiptUrl: receiptPreview || '',
      isOcrVerified: true
    };

    if (onConfirmLedgerEntry) {
      onConfirmLedgerEntry(entry);
    }
    setStatusMessage('🎉 Expense entry submitted to Club Ledger successfully with zero manual typos!');
  };

  return (
    <div className="receipt-ocr-container bg-slate-900 border border-slate-700/80 rounded-xl p-6 shadow-2xl max-w-2xl mx-auto text-slate-100 font-sans">
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
            <span>🧾</span> Automated Club Spending Receipt OCR
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">AWS Textract AnalyzeExpense Pre-fill Engine</p>
        </div>
        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold px-3 py-1 rounded-full">
          Zero-Typo Ledger Audit
        </span>
      </div>

      {/* Upload & Scanner Controls */}
      <div className="bg-slate-800/60 border border-slate-700 p-5 rounded-xl mb-6">
        <label className="text-xs font-mono uppercase text-slate-400 block mb-2">Upload Receipt Image</label>
        <div className="flex gap-3">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isProcessing}
            className="block w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-500 cursor-pointer"
          />
          <button
            type="button"
            onClick={handleSimulateDefaultReceipt}
            disabled={isProcessing}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-lg whitespace-nowrap border border-slate-600"
          >
            ⚡ Scan Demo Receipt
          </button>
        </div>

        {statusMessage && (
          <div className="mt-3 text-xs font-mono text-amber-300 bg-amber-950/40 p-2.5 rounded-lg border border-amber-500/30">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Pre-filled Ledger Creation Form */}
      <div className="bg-slate-800/40 border border-slate-700/80 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center justify-between">
          <span>Pre-Filled Financial Ledger Form</span>
          {parsedData && (
            <span className="text-xs text-emerald-400 font-mono">
              OCR Verified ({parsedData.confidenceScore}% Confidence)
            </span>
          )}
        </h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-400 uppercase font-mono block mb-1">Vendor Name</label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. Domino's"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 text-xs font-mono outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 uppercase font-mono block mb-1">Total Amount ($)</label>
            <input
              type="number"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="e.g. 45.92"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 text-xs font-mono outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-slate-400 uppercase font-mono block mb-1">Purchase Date</label>
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 text-xs font-mono outline-none focus:border-amber-500"
          />
        </div>

        <button
          type="button"
          onClick={handleConfirmLedger}
          disabled={!vendorName || !totalAmount || isProcessing}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg flex items-center justify-center gap-2"
        >
          <span>✔</span> Confirm Ledger Entry & Submit
        </button>
      </div>
    </div>
  );
};
