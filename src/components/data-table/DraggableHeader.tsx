// =============================================================================
// Component: DraggableHeader
// Issue: #2453 - High-performance SortableTable with multi-column sorting
// Description: Wraps the <th> element with @dnd-kit sortable hooks to enable 
// drag-and-drop column reordering, while also handling TanStack's sort clicks.
// =============================================================================

import React from 'react';
import { Header, flexRender } from '@tanstack/react-table';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DraggableHeaderProps<TData> {
    header: Header<TData, unknown>;
}

export function DraggableHeader<TData>({ header }: DraggableHeaderProps<TData>) {
    // Hook into @dnd-kit for drag-and-drop functionality
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: header.id,
        // Disable drag if the column is not resizable or if it's a special action column
        disabled: !header.column.getCanSort(),
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
    };

    // Determine sort direction icon
    const sorted = header.column.getIsSorted();

    const SortIcon = () => {
        if (!header.column.getCanSort()) return null;

        return (
            <span className="ml-2 inline-flex flex-col text-gray-400 dark:text-gray-500">
                {sorted === 'asc' ? (
                    <svg className="w-3 h-3 text-indigo-600 dark:text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 3l-7 7h14l-7-7z" />
                    </svg>
                ) : sorted === 'desc' ? (
                    <svg className="w-3 h-3 text-indigo-600 dark:text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 17l7-7H3l7 7z" />
                    </svg>
                ) : (
                    <svg className="w-3 h-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 3l-7 7h14l-7-7zM10 17l7-7H3l7 7z" />
                    </svg>
                )}
            </span>
        );
    };

    return (
        <th
            ref={setNodeRef}
            style={style}
            className={`
        px-6 py-3 text-left text-xs font-medium uppercase tracking-wider 
        text-gray-500 dark:text-gray-400 select-none
        ${header.column.getCanSort() ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50' : ''}
        ${isDragging ? 'z-50 cursor-grabbing' : 'cursor-default'}
      `}
            colSpan={header.colSpan}
            {...attributes}
        >
            <div className="flex items-center justify-between w-full">
                {/* The clickable area for sorting */}
                <div
                    className="flex items-center flex-1"
                    onClick={header.column.getToggleSortingHandler()}
                    title={
                        header.column.getCanSort()
                            ? `Hold Shift to multi-sort. Currently ${sorted ? sorted : 'unsorted'}`
                            : ''
                    }
                >
                    {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    <SortIcon />
                </div>

                {/* The drag handle (visible on hover) */}
                {header.column.getCanSort() && (
                    <button
                        className="ml-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                        {...listeners}
                        aria-label="Drag to reorder column"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                )}
            </div>
        </th>
    );
}
