// =============================================================================
// Component: DiffChunk
// Issue: #2439 - Sophisticated RichTextDiffViewer for auditing Constitution changes
// Description: Renders a single chunk of diffed text with appropriate styling 
// based on whether it was added, removed, or neutral.
// =============================================================================

import React from 'react';
import { DiffChunk as DiffChunkType } from '../../utils/textDiffer';

interface DiffChunkProps {
    chunk: DiffChunkType;
}

export const DiffChunkComponent: React.FC<DiffChunkProps> = ({ chunk }) => {
    // Handle line breaks explicitly to preserve paragraph structure
    const parts = chunk.value.split('\n');

    return (
        <>
            {parts.map((part, index) => (
                <React.Fragment key={index}>
                    {part && (
                        <span
                            className={`
                rounded-sm px-0.5 transition-colors
                ${chunk.added
                                    ? 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 font-medium border-b-2 border-green-500 dark:border-green-400'
                                    : ''}
                ${chunk.removed
                                    ? 'bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-100 line-through decoration-red-500 dark:decoration-red-400 decoration-2'
                                    : ''}
                ${!chunk.added && !chunk.removed
                                    ? 'text-gray-800 dark:text-gray-200'
                                    : ''}
              `}
                        >
                            {part}
                        </span>
                    )}
                    {index < parts.length - 1 && <br />}
                </React.Fragment>
            ))}
        </>
    );
};
