// =============================================================================
// Component: SortableTable (High-Performance Data Grid)
// Issue: #2453 - High-performance SortableTable with multi-column sorting
// Description: A modern, highly interactive data grid built on TanStack Table
// and @dnd-kit/core. Supports manual server-side sorting for massive datasets
// (50,000+ rows) and drag-and-drop column reordering.
// =============================================================================

import React, { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  ColumnDef,
  SortingState,
  flexRender,
  ColumnOrderState,
} from "@tanstack/react-table";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { DraggableHeader } from "./DraggableHeader";
import { TableControls } from "./TableControls";

interface SortableTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  sorting: SortingState;
  setSorting: (sorting: SortingState) => void;
  rowCount: number;
  isLoading?: boolean;
  onColumnOrderChange?: (order: ColumnOrderState) => void;
}

export function SortableTable<TData>({
  data,
  columns,
  sorting,
  setSorting,
  rowCount,
  isLoading = false,
  onColumnOrderChange,
}: SortableTableProps<TData>) {
  // State for column reordering
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(
    columns.map((c) => c.id || ""),
  );

  // State for drag-and-drop overlay
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Configure DnD sensors with a slight activation constraint to prevent
  // accidental drags when just clicking to sort.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  // Initialize TanStack Table with MANUAL SORTING enabled.
  // This is CRITICAL for 50,000+ row datasets. We do NOT use getSortedRowModel
  // to sort in memory; we let the backend Postgres handle the ORDER BY.
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnOrder,
    },
    onSortingChange: setSorting,
    onColumnOrderChange: (updater) => {
      const newOrder = typeof updater === "function" ? updater(columnOrder) : updater;
      setColumnOrder(newOrder);
      onColumnOrderChange?.(newOrder);
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true, // Disables client-side sorting
    enableMultiSort: true, // Allows Shift+Click for multi-column sorting
    manualPagination: true,
  });

  // DnD Event Handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(String(active.id));
      const newIndex = columnOrder.indexOf(String(over.id));

      if (oldIndex !== -1 && newIndex !== -1) {
        setColumnOrder((prev) => arrayMove(prev, oldIndex, newIndex));
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  // Find the active column for the DragOverlay
  const activeColumn = activeId ? columns.find((c) => c.id === activeId) : null;

  return (
    <div className="w-full space-y-4">
      <TableControls table={table} rowCount={rowCount} isLoading={isLoading} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{
          announcements: {
            onDragStart({ active }) {
              return `Column ${active.id} selected.`;
            },
            onDragOver({ active, over }) {
              if (over) {
                return `Column ${active.id} moved over column ${over.id}.`;
              }
              return `Column ${active.id} is no longer over a droppable area.`;
            },
            onDragEnd({ active, over }) {
              if (over) {
                return `Column ${active.id} was dropped over column ${over.id}.`;
              }
              return `Column ${active.id} was dropped.`;
            },
            onDragCancel({ active }) {
              return `Dragging was cancelled. Column ${active.id} was dropped.`;
            },
          },
        }}
      >
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <SortableContext
                    items={headerGroup.headers.map((h) => h.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header) => (
                      <DraggableHeader key={header.id} header={header} />
                    ))}
                  </SortableContext>
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {isLoading ? (
                // Skeleton Loading State
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    {columns.map((_, j) => (
                      <td key={j} className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    No results found. Try adjusting your filters or sorting criteria.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Drag Overlay: Renders a floating copy of the column being dragged */}
        <DragOverlay>
          {activeColumn ? (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-100 dark:bg-gray-700 shadow-lg rounded-lg opacity-90 cursor-grabbing">
                    {activeColumn.header as string}
                  </th>
                </tr>
              </thead>
            </table>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
