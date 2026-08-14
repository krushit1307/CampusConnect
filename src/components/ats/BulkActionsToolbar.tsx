// =============================================================================
// Component: BulkActionsToolbar
--Issue: #2978 - Build a 'Club Application & Tryout' Workflow
--Description: Floating toolbar that appears when multiple applications are
--selected on the Kanban board.Allows executives to perform bulk status
--updates and trigger mass email notifications.
// =============================================================================

import React from 'react';
import { Application } from '../../hooks/useApplications';

interface BulkActionsToolbarProps {
    selectedCount: number;
    onBulkAction: (status: Application['status']) => void;
    onClearSelection: () => void;
}

export const BulkActionsToolbar: React.FC<BulkActionsToolbarProps> = ({
    selectedCount,
    onBulkAction,
    onClearSelection
}) => {
    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 dark:bg-gray-800 text-white rounded-full shadow-2xl border border-gray-700 px-6 py-3 flex items-center gap-4 animate-slide-up">
            <span className="text-sm font-medium">
                <span className="font-bold text-indigo-400">{selectedCount}</span> selected
            </span>

            <div className="w-px h-6 bg-gray-700"></div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => onBulkAction('review')}
                    className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
                >
                    Move to Review
                </button>
                <button
                    onClick={() => onBulkAction('interview')}
                    className="px-3 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 rounded-full transition-colors"
                >
                    Invite to Interview
                </button>
                <button
                    onClick={() => onBulkAction('accepted')}
                    className="px-3 py-1.5 text-xs font-bold bg-green-600 hover:bg-green-700 rounded-full transition-colors"
                >
                    Accept
                </button>
                <button
                    onClick={() => onBulkAction('rejected')}
                    className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                >
                    Reject
                </button>
            </div>

            <button
                onClick={onClearSelection}
                className="p-1.5 hover:bg-gray-700 rounded-full transition-colors"
                title="Clear selection"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <style>{`
        @keyframes slide-up {
          from { transform: translate(-50%, 100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
        </div>
    );
};
