// =============================================================================
// Component: AccessibilityPortal
//  Issue: #3551 - Implement 'Dynamic Accessibility Sign Language Interpreter Request'
//  Description: The admin dashboard for the University Disability Resource Center.
//  Displays a queue of pending accessibility requests across all events, allowing
//  staff to review details and click "Confirm" to notify the student.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AccessibilityRequest, useAccessibilityRequests } from '../../hooks/useAccessibilityRequests';

export const AccessibilityPortal: React.FC = () => {
    const [requests, setRequests] = useState<(AccessibilityRequest & { events?: any; profiles?: any })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { updateStatus } = useAccessibilityRequests();

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('accessibility_requests')
                .select(`
          *,
          events (title, event_date, location),
          profiles:user_id (full_name, email)
        `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests((data as any[]) || []);
        } catch (err) {
            console.error('Failed to fetch requests:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = async (id: string) => {
        const success = await updateStatus(id, 'confirmed');
        if (success) {
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'confirmed' } : r));
            // In a real app, trigger a push notification to the student here
        }
    };

    const handleDeny = async (id: string) => {
        if (!confirm('Are you sure you cannot fulfill this request? The student will be notified.')) return;
        const success = await updateStatus(id, 'denied');
        if (success) {
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'denied' } : r));
        }
    };

    const pendingRequests = requests.filter(r => r.status === 'pending');
    const resolvedRequests = requests.filter(r => r.status !== 'pending');

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white">Accessibility Request Portal</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Manage and confirm ASL interpreter and accommodation requests for campus events.
                </p>
            </div>

            {/* Pending Queue */}
            <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></span>
                    Pending Confirmation ({pendingRequests.length})
                </h2>

                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2].map(i => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>)}
                    </div>
                ) : pendingRequests.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                        <p className="text-gray-500 dark:text-gray-400">No pending requests. All caught up!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pendingRequests.map(req => (
                            <RequestCard
                                key={req.id}
                                request={req}
                                onConfirm={handleConfirm}
                                onDeny={handleDeny}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Resolved History */}
            {resolvedRequests.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                        Recent History
                    </h2>
                    <div className="space-y-3 opacity-70">
                        {resolvedRequests.slice(0, 10).map(req => (
                            <RequestCard
                                key={req.id}
                                request={req}
                                onConfirm={handleConfirm}
                                onDeny={handleDeny}
                                isResolved
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const RequestCard: React.FC<{
    request: AccessibilityRequest & { events?: any; profiles?: any };
    onConfirm: (id: string) => void;
    onDeny: (id: string) => void;
    isResolved?: boolean;
}> = ({ request, onConfirm, onDeny, isResolved }) => {

    const formatType = (type: string) => type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm ${isResolved ? 'opacity-60' : ''}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${request.request_type === 'asl_interpreter' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                                'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                            }`}>
                            {formatType(request.request_type)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            Requested {new Date(request.created_at).toLocaleDateString()}
                        </span>
                    </div>

                    <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate">
                        {request.events?.title || 'Unknown Event'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(request.events?.event_date).toLocaleString()} • {request.events?.location || 'TBA'}
                    </p>

                    <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm">
                        <span className="font-bold text-gray-700 dark:text-gray-300">Student:</span>{' '}
                        <span className="text-gray-900 dark:text-white">{request.profiles?.full_name}</span>{' '}
                        <a href={`mailto:${request.profiles?.email}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                            ({request.profiles?.email})
                        </a>
                    </div>

                    {request.additional_notes && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic border-l-2 border-gray-300 dark:border-gray-600 pl-3">
                            "{request.additional_notes}"
                        </p>
                    )}
                </div>

                {!isResolved && request.status === 'pending' && (
                    <div className="flex flex-col gap-2 flex-shrink-0 w-full md:w-auto">
                        <button
                            onClick={() => onConfirm(request.id)}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-sm shadow-sm"
                        >
                            ✅ Confirm & Notify
                        </button>
                        <button
                            onClick={() => onDeny(request.id)}
                            className="px-6 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium"
                        >
                            Cannot Fulfill
                        </button>
                    </div>
                )}

                {isResolved && (
                    <div className={`px-4 py-2 rounded-lg font-bold text-sm ${request.status === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        {request.status.toUpperCase()}
                    </div>
                )}
            </div>
        </div>
    );
};
