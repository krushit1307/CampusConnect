// =============================================================================
// Component: ToneAnalyzerWarning
// Issue: #3557 - Implement 'Automated Event Description "Tone" Analyzer'
// Description: A soft warning modal presented to official university department
// accounts when their event description is flagged as too informal. Provides
// a 1-click "Rewrite Professionally" button using AI.
// =============================================================================

import React from 'react';
import { ToneAnalysisResult } from '../../hooks/useToneAnalyzer';

interface ToneAnalyzerWarningProps {
    analysis: ToneAnalysisResult;
    isRewriting: boolean;
    onRewrite: () => void;
    onProceedAnyway: () => void;
    onClose: () => void;
}

export const ToneAnalyzerWarning: React.FC<ToneAnalyzerWarningProps> = ({
    analysis,
    isRewriting,
    onRewrite,
    onProceedAnyway,
    onClose
}) => {
    if (!analysis.requiresReview) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
                {/* Header */}
                <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">
                                Brand Guideline Warning
                            </h3>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                This description appears highly informal and may not align with University Brand Guidelines.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Warnings List */}
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Detected Issues:
                        </p>
                        <ul className="space-y-2">
                            {analysis.warnings.map((warning, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                    <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    <span>{warning}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs text-blue-800 dark:text-blue-300">
                            <span className="font-bold">Formality Score:</span> {analysis.score}/100
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <button
                        onClick={onRewrite}
                        disabled={isRewriting}
                        className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-bold text-sm flex items-center justify-center gap-2 shadow-sm"
                    >
                        {isRewriting ? (
                            <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Rewriting with AI...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                ✨ Rewrite Professionally (AI)
                            </>
                        )}
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={onClose}
                            className="py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onProceedAnyway}
                            className="py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium underline"
                        >
                            Proceed Anyway
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
