// =============================================================================
// Component: ReportCard
//  Issue: #3321 - Implement 'Role-Based Content Moderation Queues'
//  Description: Renders an individual report in the moderation queue. Displays 
//  the severity, category, and provides action buttons to resolve or dismiss.
//  =============================================================================

import React, { useState } from 'react';
import { ModerationReport, ReportCategory } from '../../hooks/useModerationQueue';

interface ReportCardProps {
    report: ModerationReport;
    onResolve: (id: string, action: string) => Promise<boolean>;
    onDismiss: (id: string) => Promise<boolean>;
}

export const ReportCard: React.FC<ReportCardProps> = ({ report, onResolve, onDismiss }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [showActions, setShowActions] = useState(false);

    const getCategoryConfig = (cat: ReportCategory) => {
        switch (cat) {
            case 'danger': return { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-800 dark:text-red-300', icon: '🚨' };
            case 'harassment': return { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-800 dark:text-orange-300', icon: '⚠️' };
            case 'spam': return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300', icon: '🗑️' };
            case 'misinformation': return { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-800 dark:text-yellow-300', icon: '📰' };
            default: return { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-300', icon: '📝' };
        }
    };

    const config = getCategoryConfig(report.category);

    const handleAction = async (action: string) => {
        setIsProcessing(true);
        if (action === 'dismiss') {
            await onDismiss(report.id);
        } else {
            await onResolve(report.id, action);
        }
        setIsProcessing(false);
    };

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-xl border-l-4 shadow-sm transition-all ${report.severity >= 4 ? 'border-red-500 ring-2 ring-red-500/20' : 'border-gray-200 dark:border-gray-700'
            }`}>
            <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${config.bg} ${config.text}`}>
                            {config.icon} {report.category.toUpperCase()}
                        </span>
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                            Severity: {report.severity}/5
                        </span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(report.created_at).toLocaleString()}
                    </span>
                </div>

                <p className="text-sm text-gray-800 dark:text-gray-200 mb-4 leading-relaxed">
                    <span className="font-bold">Reason:</span> {report.reason}
                </p>

                {report.content_preview && (
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 mb-4 text-xs text-gray-600 dark:text-gray-400 italic">
                        "{report.content_preview}"
                    </div>
                )}

                {/* Action Buttons */}
                {!showActions ? (
                    <button
                        onClick={() => setShowActions(true)}
                        disabled={isProcessing}
                        className="w-full py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-sm font-bold transition-colors"
                    >
                        Review & Take Action
                    </button>
                ) : (
                    <div className="space-y-2 animate-fade-in">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handleAction('delete_content')}
                                disabled={isProcessing}
                                className="py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-bold disabled:opacity-50"
                            >
                                Delete Content
                            </button>
                            <button
                                onClick={() => handleAction('ban_user')}
                                disabled={isProcessing}
                                className="py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:opacity-90 text-xs font-bold disabled:opacity-50"
                            >
                                Ban User
                            </button>
                        </div>
                        <button
                            onClick={() => handleAction('dismiss')}
                            disabled={isProcessing}
                            className="w-full py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-medium disabled:opacity-50"
                        >
                            Dismiss (False Positive)
                        </button>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
        }
      `}</style>
        </div>
    );
};
