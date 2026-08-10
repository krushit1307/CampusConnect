// =============================================================================
// Component: RichTextDiffViewer
// Issue: #2439 - Sophisticated RichTextDiffViewer for auditing Constitution changes
// Description: Renders a Git-style side-by-side or inline diff view.
// Highlights added words in green and removed words in red with strikethrough.
// Fully supports Dark/Light mode via Tailwind CSS.
// =============================================================================

import React, { useMemo } from 'react';
import { stripHtmlTags, diffWords, DiffChunk } from '../../utils/textDiffer';
import { DiffChunkComponent } from './DiffChunk';

interface RichTextDiffViewerProps {
    oldText: string;
    newText: string;
    mode?: 'inline' | 'split';
    title?: string;
}

export const RichTextDiffViewer: React.FC<RichTextDiffViewerProps> = ({
    oldText,
    newText,
    mode = 'inline',
    title = 'Document Changes'
}) => {
    // Memoize the heavy diffing computation.
    // We strip HTML first to prevent the "angle bracket" diffing catastrophe.
    const { oldPlain, newPlain, chunks } = useMemo(() => {
        const oldPlain = stripHtmlTags(oldText);
        const newPlain = stripHtmlTags(newText);
        const chunks = diffWords(oldPlain, newPlain);

        return { oldPlain, newPlain, chunks };
    }, [oldText, newText]);

    // Calculate stats for the header
    const addedCount = chunks.filter(c => c.added).reduce((sum, c) => sum + c.value.split(/\s+/).length, 0);
    const removedCount = chunks.filter(c => c.removed).reduce((sum, c) => sum + c.value.split(/\s+/).length, 0);

    return (
        <div className="w-full max-w-6xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Review the changes made to the constitution before approving.
                    </p>
                </div>
                <div className="flex gap-4 text-sm font-medium">
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-red-500"></span>
                        <span className="text-red-600 dark:text-red-400">-{removedCount} words</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-green-500"></span>
                        <span className="text-green-600 dark:text-green-400">+{addedCount} words</span>
                    </span>
                </div>
            </div>

            {/* Diff Content */}
            <div className="p-6 max-h-[600px] overflow-y-auto custom-scrollbar">
                {mode === 'inline' ? (
                    <div className="prose prose-gray dark:prose-invert max-w-none leading-relaxed text-gray-800 dark:text-gray-200">
                        {chunks.map((chunk, index) => (
                            <DiffChunkComponent key={index} chunk={chunk} />
                        ))}
                    </div>
                ) : (
                    <SplitView oldText={oldPlain} newText={newPlain} chunks={chunks} />
                )}
            </div>

            {/* Footer Legend */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded font-mono">deleted text</span>
                    <span>Removed content</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded font-mono">added text</span>
                    <span>New content</span>
                </div>
            </div>
        </div>
    );
};

/**
 * Sub-component for Split (Side-by-Side) View
 * Reconstructs the old and new text into parallel columns.
 */
const SplitView: React.FC<{ oldText: string; newText: string; chunks: DiffChunk[] }> = ({ chunks }) => {
    const oldParagraphs = useMemo(() => {
        const parts: React.ReactNode[] = [];
        chunks.forEach((chunk, i) => {
            if (!chunk.added) {
                parts.push(<DiffChunkComponent key={`old-${i}`} chunk={chunk} />);
            } else {
                // Insert empty space to maintain alignment with the right column
                parts.push(<span key={`empty-${i}`} className="invisible">{chunk.value}</span>);
            }
        });
        return parts;
    }, [chunks]);

    const newParagraphs = useMemo(() => {
        const parts: React.ReactNode[] = [];
        chunks.forEach((chunk, i) => {
            if (!chunk.removed) {
                parts.push(<DiffChunkComponent key={`new-${i}`} chunk={chunk} />);
            } else {
                parts.push(<span key={`empty-new-${i}`} className="invisible">{chunk.value}</span>);
            }
        });
        return parts;
    }, [chunks]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-r border-gray-200 dark:border-gray-700 pr-6">
                <div className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-3">
                    Original Version
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-gray-700 dark:text-gray-300">
                    {oldParagraphs}
                </div>
            </div>
            <div>
                <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-3">
                    Proposed Version
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-gray-700 dark:text-gray-300">
                    {newParagraphs}
                </div>
            </div>
        </div>
    );
};
