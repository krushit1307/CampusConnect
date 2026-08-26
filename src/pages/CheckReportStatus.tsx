// =============================================================================
// Page: CheckReportStatus
--Issue: #2969 - Build an 'Anonymous Incident Reporting' Workflow
--Description: Public page allowing users to check the status of their
--anonymous report using their Claim Ticket.Does not require authentication.
// =============================================================================

import React, { useState } from 'react';
import { useIncidentReports, IncidentStatus } from '../hooks/useIncidentReports';

export const CheckReportStatus: React.FC = () => {
    const { checkStatus, isChecking } = useIncidentReports();
    const [ticket, setTicket] = useState('');
    const [result, setResult] = useState<IncidentStatus | null>(null);
    const [notFound, setNotFound] = useState(false);

    const handleCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        setNotFound(false);
        setResult(null);

        const status = await checkStatus(ticket);
        if (status) {
            setResult(status);
        } else {
            setNotFound(true);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400';
            case 'under_investigation': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400';
            case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400';
            case 'dismissed': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-8 text-center border-b border-gray-200 dark:border-gray-700">
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Check Report Status</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Enter your Claim Ticket to view the current status of your anonymous report.
                    </p>
                </div>

                <form onSubmit={handleCheck} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Claim Ticket Code
                        </label>
                        <input
                            type="text"
                            value={ticket}
                            onChange={(e) => setTicket(e.target.value.toUpperCase())}
                            placeholder="e.g., A1B2C3D4E5F6"
                            maxLength={12}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 text-center font-mono text-lg tracking-widest uppercase"
                            required
                        />
                    </div>

                    {notFound && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm text-center">
                            No report found with this ticket. Please check the code and try again.
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isChecking || ticket.length < 12}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-colors"
                    >
                        {isChecking ? 'Checking...' : 'Check Status'}
                    </button>
                </form>

                {result && (
                    <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Event</span>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{result.event_title}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Submitted</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                {new Date(result.submitted_at).toLocaleDateString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Status</span>
                            <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase ${getStatusColor(result.status)}`}>
                                {result.status.replace('_', ' ')}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
