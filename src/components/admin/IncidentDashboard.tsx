// =============================================================================
// Component: IncidentDashboard
//Issue: #2969 - Build an 'Anonymous Incident Reporting' Workflow
//Description: Secure portal for the University Disciplinary Board to review
//anonymous claims, update statuses, leave internal notes, and manage escalations.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface IncidentReport {
    id: string;
    event_id: string;
    description: string;
    status: string;
    is_escalated: boolean;
    escalation_reason: string | null;
    internal_notes: string | null;
    claim_ticket: string;
    submitted_at: string;
    events?: { title: string };
}

export const IncidentDashboard: React.FC = () => {
    const [reports, setReports] = useState<IncidentReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        fetchReports();
    }, [filter]);

    const fetchReports = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('incident_reports')
                .select(`*, events(title)`)
                .order('submitted_at', { ascending: false });

            if (filter === 'escalated') {
                query = query.eq('is_escalated', true);
            } else if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query;
            if (error) throw error;
            setReports((data as IncidentReport[]) || []);
        } catch (err) {
            console.error('Failed to fetch reports:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const updateStatus = async (id: string, status: string) => {
        await supabase.from('incident_reports').update({ status }).eq('id', id);
        fetchReports();
        if (selectedReport?.id === id) {
            setSelectedReport({ ...selectedReport, status });
        }
    };

    const saveNotes = async (id: string, notes: string) => {
        await supabase.from('incident_reports').update({ internal_notes: notes }).eq('id', id);
        fetchReports();
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">Incident Dashboard</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Disciplinary Board Portal</p>
                </div>
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                    <option value="all">All Reports</option>
                    <option value="escalated">Escalated Only</option>
                    <option value="pending">Pending</option>
                    <option value="under_investigation">Under Investigation</option>
                    <option value="resolved">Resolved</option>
                </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* List of Reports */}
                <div className="lg:col-span-1 space-y-3 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>)}
                        </div>
                    ) : reports.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-8">No reports found.</p>
                    ) : (
                        reports.map(report => (
                            <button
                                key={report.id}
                                onClick={() => setSelectedReport(report)}
                                className={`w-full text-left p-4 rounded-xl border transition-all ${selectedReport?.id === report.id
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md'
                                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${report.is_escalated ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400' :
                                            report.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400' :
                                                'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400'
                                        }`}>
                                        {report.is_escalated ? 'ESCALATED' : report.status.replace('_', ' ').toUpperCase()}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {new Date(report.submitted_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="font-bold text-gray-900 dark:text-white text-sm truncate">
                                    {report.events?.title}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                                    {report.description}
                                </p>
                            </button>
                        ))
                    )}
                </div>

                {/* Report Details */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 min-h-[60vh]">
                    {selectedReport ? (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedReport.events?.title}</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Ticket: {selectedReport.claim_ticket}</p>
                                </div>
                                <select
                                    value={selectedReport.status}
                                    onChange={(e) => updateStatus(selectedReport.id, e.target.value)}
                                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-white"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="under_investigation">Under Investigation</option>
                                    <option value="resolved">Resolved</option>
                                    <option value="dismissed">Dismissed</option>
                                </select>
                            </div>

                            {selectedReport.is_escalated && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="font-bold text-red-800 dark:text-red-300 flex items-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        Mandatory Escalation Triggered
                                    </p>
                                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{selectedReport.escalation_reason}</p>
                                </div>
                            )}

                            <div>
                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Description</h3>
                                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
                                    {selectedReport.description}
                                </p>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Internal Notes</h3>
                                <textarea
                                    defaultValue={selectedReport.internal_notes || ''}
                                    onBlur={(e) => saveNotes(selectedReport.id, e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
                                    placeholder="Add private notes for the disciplinary board..."
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                            Select a report to view details.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
