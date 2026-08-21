// =============================================================================
// Component: ReconciliationVarianceAlert
//  Issue: #3545 - Implement 'Automated Post-Event Expense Reconciliation'
//  Description: Displays the result of the OCR scan, comparing the extracted 
//  receipt total against the approved budget. Highlights significant variances 
//  that require manual auditing by the Student Union.
// =============================================================================

import React from 'react';
import { ReconciliationResult } from '../../hooks/useExpenseReconciliation';

interface ReconciliationVarianceAlertProps {
    result: ReconciliationResult;
    approvedBudgetCents: number;
}

export const ReconciliationVarianceAlert: React.FC<ReconciliationVarianceAlertProps> = ({
    result,
    approvedBudgetCents
}) => {
    const isOverBudget = result.variance_pct > 0;
    const isSignificantVariance = Math.abs(result.variance_pct) > 10;

    const statusConfig = {
        reconciled: {
            bg: 'bg-green-50 dark:bg-green-900/20',
            border: 'border-green-200 dark:border-green-800',
            text: 'text-green-800 dark:text-green-300',
            icon: (
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            title: 'Auto-Reconciled'
        },
        needs_audit: {
            bg: 'bg-amber-50 dark:bg-amber-900/20',
            border: 'border-amber-200 dark:border-amber-800',
            text: 'text-amber-800 dark:text-amber-300',
            icon: (
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            ),
            title: 'Needs Manual Audit'
        },
        failed_ocr: {
            bg: 'bg-red-50 dark:bg-red-900/20',
            border: 'border-red-200 dark:border-red-800',
            text: 'text-red-800 dark:text-red-300',
            icon: (
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            title: 'OCR Failed'
        }
    };

    const config = statusConfig[result.status] || statusConfig.needs_audit;

    return (
        <div className={`p-4 rounded-xl border ${config.bg} ${config.border} ${config.text}`}>
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
                <div className="flex-1">
                    <h4 className="font-bold text-base mb-2">{config.title}</h4>

                    {result.status !== 'failed_ocr' && (
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="opacity-80">Extracted Vendor:</span>
                                <span className="font-bold">{result.vendor}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="opacity-80">Receipt Total:</span>
                                <span className="font-bold">${(result.amount_cents / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="opacity-80">Approved Budget:</span>
                                <span className="font-medium">${(approvedBudgetCents / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-current/20">
                                <span className="opacity-80">Variance:</span>
                                <span className={`font-black ${isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                    {isOverBudget ? '+' : ''}{result.variance_pct.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    )}

                    {result.status === 'needs_audit' && (
                        <p className="text-xs mt-3 opacity-90">
                            The variance exceeds the 10% threshold. This expense has been flagged for manual review by the Student Union auditing team.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
