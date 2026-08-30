// =============================================================================
// Component: KanbanBoard
//Issue: #2978 - Build a 'Club Application & Tryout' Workflow
//Description: The main ATS interface for Club Executives.Features a 
//drag - and - drop Kanban board to manage applicant pipelines, a Blind Review
//toggle for bias prevention, and bulk action capabilities.
// =============================================================================

import React, { useState } from 'react';
import { useApplications, Application } from '../../hooks/useApplications';
import { ApplicationCard } from './ApplicationCard';
import { BulkActionsToolbar } from './BulkActionsToolbar';

interface KanbanBoardProps {
    clubId: string;
    formId: string;
}

const COLUMNS: { id: Application['status']; label: string; color: string }[] = [
    { id: 'applied', label: 'Applied', color: 'bg-gray-500' },
    { id: 'review', label: 'In Review', color: 'bg-blue-500' },
    { id: 'interview', label: 'Interview', color: 'bg-purple-500' },
    { id: 'accepted', label: 'Accepted', color: 'bg-green-500' },
    { id: 'rejected', label: 'Rejected', color: 'bg-red-500' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ clubId, formId }) => {
    const { applications, isLoading, updateStatus, bulkUpdateStatus } = useApplications(clubId, formId);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBlindReview, setIsBlindReview] = useState(false);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const clearSelection = () => setSelectedIds(new Set());

    const handleBulkAction = async (status: Application['status']) => {
        if (selectedIds.size === 0) return;
        await bulkUpdateStatus(Array.from(selectedIds), status);
        clearSelection();
    };

    const handleDragOver = (e: React.DragEvent, columnId: string) => {
        e.preventDefault();
        setDragOverColumn(columnId);
    };

    const handleDragLeave = () => {
        setDragOverColumn(null);
    };

    const handleDrop = async (e: React.DragEvent, newStatus: Application['status']) => {
        e.preventDefault();
        setDragOverColumn(null);
        const appId = e.dataTransfer.getData('applicationId');
        if (appId) {
            await updateStatus(appId, newStatus);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6 px-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Applicant Tracker</h2>

                <label className="flex items-center gap-3 cursor-pointer group bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="relative">
                        <input
                            type="checkbox"
                            checked={isBlindReview}
                            onChange={(e) => setIsBlindReview(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-10 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-amber-500 transition-colors"></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                    </div>
                    <div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white block">Blind Review</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Hide PII to prevent bias</span>
                    </div>
                </label>
            </div>

            {/* Kanban Columns */}
            <div className="flex-1 flex gap-4 overflow-x-auto pb-4 px-4 custom-scrollbar">
                {COLUMNS.map(column => {
                    const columnApps = applications[column.id] || [];
                    const isOver = dragOverColumn === column.id;

                    return (
                        <div
                            key={column.id}
                            className={`flex-shrink-0 w-80 flex flex-col bg-gray-100 dark:bg-gray-900/50 rounded-xl transition-all ${isOver ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : ''
                                }`}
                            onDragOver={(e) => handleDragOver(e, column.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, column.id)}
                        >
                            {/* Column Header */}
                            <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider">
                                        {column.label}
                                    </h3>
                                </div>
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded-full">
                                    {columnApps.length}
                                </span>
                            </div>

                            {/* Cards Container */}
                            <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar min-h-[200px]">
                                {columnApps.length === 0 ? (
                                    <div className="h-32 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
                                        Drop here
                                    </div>
                                ) : (
                                    columnApps.map(app => (
                                        <ApplicationCard
                                            key={app.id}
                                            application={app}
                                            isBlindReview={isBlindReview}
                                            isSelected={selectedIds.has(app.id)}
                                            onToggleSelect={toggleSelect}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bulk Actions Toolbar */}
            <BulkActionsToolbar
                selectedCount={selectedIds.size}
                onBulkAction={handleBulkAction}
                onClearSelection={clearSelection}
            />
        </div>
    );
};
