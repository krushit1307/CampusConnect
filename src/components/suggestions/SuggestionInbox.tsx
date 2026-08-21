import React, { useEffect } from 'react';
import { useSuggestions } from '../../hooks/useSuggestions';
import { Inbox, CheckCircle, Clock, AlertTriangle, Eye, ShieldAlert } from 'lucide-react';
import { ClubSuggestion } from '../../types/suggestions';

interface SuggestionInboxProps {
    clubId: string;
}

export const SuggestionInbox: React.FC<SuggestionInboxProps> = ({ clubId }) => {
    const { suggestions, loading, error, fetchSuggestions, updateStatus } = useSuggestions(clubId);

    useEffect(() => {
        fetchSuggestions();
    }, [fetchSuggestions]);

    const getStatusBadge = (status: ClubSuggestion['status']) => {
        switch (status) {
            case 'UNREAD':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <Clock className="w-3 h-3 mr-1" /> Unread
                    </span>
                );
            case 'REVIEWED':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        <Eye className="w-3 h-3 mr-1" /> Reviewed
                    </span>
                );
            case 'ACTIONED':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        <CheckCircle className="w-3 h-3 mr-1" /> Actioned
                    </span>
                );
            default:
                return null;
        }
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(date);
    };

    if (loading && suggestions.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 flex flex-col items-center justify-center space-y-4">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Loading inbox securely...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 mt-0.5" />
                    <div>
                        <p className="font-medium">Error loading suggestions</p>
                        <p className="text-sm mt-1">{error}</p>
                        <button
                            onClick={fetchSuggestions}
                            className="mt-3 text-sm font-medium text-red-800 hover:text-red-900 underline"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col h-full min-h-[500px]">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                        <Inbox className="w-5 h-5 text-gray-700" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Executive Inbox</h3>
                        <p className="text-xs text-gray-500">Anonymous feedback queue</p>
                    </div>
                </div>

                <div className="flex items-center space-x-2 text-sm bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                    <span className="font-semibold text-indigo-600">
                        {suggestions.filter(s => s.status === 'UNREAD').length}
                    </span>
                    <span className="text-gray-500">Unread</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6 space-y-4">
                {suggestions.length === 0 ? (
                    <div className="text-center py-12 flex flex-col items-center">
                        <Inbox className="w-12 h-12 text-gray-300 mb-4" />
                        <h4 className="text-base font-medium text-gray-900">Inbox is empty</h4>
                        <p className="text-sm text-gray-500 mt-1 max-w-sm">No anonymous suggestions have been submitted yet. Keep an eye out!</p>
                    </div>
                ) : (
                    suggestions.map((suggestion) => (
                        <div
                            key={suggestion.id}
                            className={`bg-white border rounded-xl p-5 shadow-sm transition-all hover:shadow-md ${suggestion.status === 'UNREAD' ? 'border-indigo-200 bg-indigo-50/10 relative overflow-hidden' : 'border-gray-200'
                                }`}
                        >
                            {suggestion.status === 'UNREAD' && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                            )}

                            <div className="flex justify-between items-start mb-3">
                                {getStatusBadge(suggestion.status)}
                                <span className="text-xs text-gray-400 font-medium">
                                    {formatDate(suggestion.submitted_at)}
                                </span>
                            </div>

                            {suggestion.is_quarantined && (
                                <div className="mb-3 flex items-center space-x-2 text-xs font-medium text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                                    <ShieldAlert className="w-4 h-4" />
                                    <span>Flagged by automated filters. Review with caution.</span>
                                </div>
                            )}

                            <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">
                                {suggestion.message_text}
                            </p>

                            <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                                {suggestion.status === 'UNREAD' && (
                                    <button
                                        onClick={() => updateStatus(suggestion.id, 'REVIEWED')}
                                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                                    >
                                        Mark as Reviewed
                                    </button>
                                )}
                                {suggestion.status !== 'ACTIONED' && (
                                    <button
                                        onClick={() => updateStatus(suggestion.id, 'ACTIONED')}
                                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                                    >
                                        Action Completed
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="bg-white border-t border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-400">
                    Suggestions automatically expire and are purged after 90 days.
                </p>
            </div>
        </div>
    );
};
