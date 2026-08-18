// =============================================================================
// Hook: useExpenseReconciliation
//  Issue: #3545 - Implement 'Automated Post-Event Expense Reconciliation'
//  Description: Manages the upload of receipt images to Supabase Storage and 
//  triggers the Vision AI Edge Function. Tracks the OCR processing state and 
//  returns the calculated budget variance for the UI.
// =============================================================================

import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface ReconciliationResult {
    vendor: string;
    amount_cents: number;
    variance_pct: number;
    status: 'reconciled' | 'needs_audit' | 'failed_ocr';
}

interface UseExpenseReconciliationReturn {
    isUploading: boolean;
    isScanning: boolean;
    error: string | null;
    uploadAndScan: (expenseId: string, clubId: string, file: File, approvedBudgetCents: number) => Promise<ReconciliationResult | null>;
}

export function useExpenseReconciliation(): UseExpenseReconciliationReturn {
    const [isUploading, setIsUploading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const uploadAndScan = async (
        expenseId: string,
        clubId: string,
        file: File,
        approvedBudgetCents: number
    ): Promise<ReconciliationResult | null> => {
        setIsUploading(true);
        setError(null);

        try {
            // 1. Upload image to Storage
            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `${clubId}/receipts/${expenseId}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('club-finance-docs')
                .upload(fileName, file, { cacheControl: '3600', upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('club-finance-docs')
                .getPublicUrl(fileName);

            // Update expense with image URL
            await supabase.from('expenses').update({ receipt_image_url: publicUrl }).eq('id', expenseId);

            // 2. Trigger OCR Edge Function
            setIsUploading(false);
            setIsScanning(true);

            const { data, error: fnError } = await supabase.functions.invoke('scan-receipt-ocr', {
                body: {
                    expense_id: expenseId,
                    image_url: publicUrl,
                    approved_budget_cents: approvedBudgetCents
                }
            });

            if (fnError) throw fnError;
            if (data.error) throw new Error(data.error);

            setIsScanning(false);
            return {
                vendor: data.vendor,
                amount_cents: data.amount_cents,
                variance_pct: data.variance_pct,
                status: data.status
            };

        } catch (err: any) {
            console.error('[useExpenseReconciliation] Failed:', err);
            setError(err.message || 'Failed to process receipt.');
            setIsUploading(false);
            setIsScanning(false);
            return null;
        }
    };

    return { isUploading, isScanning, error, uploadAndScan };
}
