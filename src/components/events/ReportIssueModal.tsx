// =============================================================================
// Component: ReportIssueModal
// Issue: #2969 - Build an 'Anonymous Incident Reporting' Workflow
--Description: The UI for students to submit anonymous incident reports.
--Includes a CAPTCHA placeholder, character limits, and displays the
--generated Claim Ticket upon successful submission.
// =============================================================================

import React, { useState } from 'react';
import { useIncidentReports } from '../../hooks/useIncidentReports';

interface ReportIssueModalProps {
    eventId: string;
    eventTitle: string;
    onClose: () => void;
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({ eventId, eventTitle, onClose }) => {
    const { submitReport, isSubmitting } = useIncidentReports();
    const [description, setDescription] = useState('');
    const [captchaVerified, setCaptchaVerified] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ ticket: string; escalated: boolean } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (description.trim().length < 20) {
            setError('Please provide a detailed description (at least 20 characters).');
            return;
        }

        if (!captchaVerified) {
            setError('Please complete the CAPTCHA verification to prove you are human.');
            return;
        }

        // In a real app, we would extract the token from the Turnstile widget
        const mockCaptchaToken = 'mock-turnstile-token-12345';
        const res = await submitReport(eventId, description, mockCaptchaToken);

        if (res.success && res.claimTicket) {
            setResult({ ticket: res.claimTicket, escalated: res.isEscalated || false });
        } else {
            setError(res.error || 'Submission failed.');
        }
    };

    const copyToClipboard = () => {
        if (result?.ticket) {
            navigator.clipboard.writeText(result.ticket);
        }
    };

    if (result) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <div className="p-8 text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${result.escalated ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'
                            }`}>
                            {result.escalated ? (
                                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            ) : (
                                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>

                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Report Submitted Anonymously
                        </h3>

                        {result.escalated && (
                            <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-4">
                                Your report contained keywords that require immediate attention and has been escalated to Campus Security.
                            </p>
                        )}

                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            Save your <span className="font-bold text-gray-900 dark:text-white">Claim Ticket</span> to check the status of your report later. We cannot recover this code if lost.
                        </p>

                        <div className="bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 mb-6">
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold mb-2">
                                Your Claim Ticket
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <span className="text-2xl font-mono font-black text-indigo-600 dark:text-indigo-400 tracking-widest">
                                    {result.ticket}
                                </span>
                                <button
                                    onClick={copyToClipboard}
                                    className="p-2 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                    title="Copy to clipboard"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-bold hover:opacity-90 transition-opacity"
                        >
                            I have saved my ticket
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
                    <h3 className="text-xl font-bold text-red-800 dark:text-red-300 flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Report an Incident
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        Reporting for: <span className="font-bold">{eventTitle}</span>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p className="font-bold">Your identity is protected.</p>
                            <p>This report is completely anonymous and decoupled from your account. The Disciplinary Board will not know who submitted this.</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Incident Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={6}
                            maxLength={5000}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                            placeholder="Please describe what happened, when it occurred, and any individuals involved. Be as detailed as possible..."
                            required
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                            {description.length}/5000
                        </p>
                    </div>

                    {/* CAPTCHA Placeholder */}
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 border-2 border-gray-400 dark:border-gray-500 rounded flex items-center justify-center">
                                {captchaVerified && (
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                            <span className="text-sm text-gray-700 dark:text-gray-300">I am human</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCaptchaVerified(!captchaVerified)}
                            className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                        >
                            {captchaVerified ? 'Reset' : 'Verify (Mock)'}
                        </button>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !captchaVerified}
                            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-2 shadow-md"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Anonymously'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
