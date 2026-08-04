import React, { useState, useEffect, useId } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnOrderState,
  type Header,
  type Table,
} from "@tanstack/react-table";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, SlidersHorizontal, ArrowUp, ArrowDown, X } from "lucide-react";

export interface DraggableAdminTableProps<TData> {
  tableId: string;
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  ariaLabel?: string;
  pinnedColumns?: string[]; // Column IDs that cannot be dragged (e.g. actions, checkboxes)
  onRowClick?: (row: TData) => void;
  renderRowContextMenu?: (row: TData, children: React.ReactNode) => React.ReactNode;
}

interface DraggableHeaderProps<TData> {
  header: Header<TData, unknown>;
  isPinned?: boolean;
}

function DraggableHeaderCell<TData>({ header, isPinned }: DraggableHeaderProps<TData>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.id,
    disabled: isPinned,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`p-3 text-left text-xs font-bold uppercase select-none relative border-b-2 border-black bg-gray-50 ${
        isDragging ? "bg-amber-100 shadow-md" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 justify-between">
        <span className="truncate">
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </span>
        {!isPinned && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder column ${header.id}`}
            className="cursor-grab active:cursor-grabbing p-0.5 text-gray-400 hover:text-black transition-colors rounded"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </th>
  );
}

export function DraggableAdminTable<TData>({
  tableId,
  data,
  columns,
  ariaLabel = "Admin Data Table",
  pinnedColumns = ["actions", "select"],
  renderRowContextMenu,
}: DraggableAdminTableProps<TData>) {
  const dndContextId = useId();
  const storageKey = `table_layout_${tableId}`;

  // Initialize columnOrder from localStorage or default columns order
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // Fallback to default columns
      }
    }
    return columns.map((col) => col.id || (col as { accessorKey?: string }).accessorKey || "");
  });

  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  // Persist column order to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined" && columnOrder.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(columnOrder));
      } catch {
        // Ignore storage write errors
      }
    }
  }, [columnOrder, storageKey]);

  const table = useReactTable({
    data,
    columns,
    state: {
      columnOrder,
    },
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((currentOrder) => {
        const oldIndex = currentOrder.indexOf(active.id as string);
        const newIndex = currentOrder.indexOf(over.id as string);
        return arrayMove(currentOrder, oldIndex, newIndex);
      });
    }
  };

  const moveColumn = (colId: string, direction: "up" | "down") => {
    setColumnOrder((currentOrder) => {
      const index = currentOrder.indexOf(colId);
      if (index < 0) return currentOrder;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= currentOrder.length) return currentOrder;
      return arrayMove(currentOrder, index, targetIndex);
    });
  };

  const visibleHeaders = table.getFlatHeaders();
  const sortableColumnIds = columnOrder.filter((id) => !pinnedColumns.includes(id));

  return (
    <div className="space-y-3" data-testid={`draggable-table-container-${tableId}`}>
      {/* Table controls bar */}
      <div className="flex items-center justify-between font-mono text-xs">
        <span className="text-gray-500 font-bold uppercase">
          {data.length} row{data.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => setIsManageModalOpen(true)}
          className="neu-border bg-white px-3 py-1.5 font-bold uppercase hover:bg-gray-100 flex items-center gap-1.5 shadow-[2px_2px_0_0_#000]"
          aria-label="Manage columns layout"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Manage Columns
        </button>
      </div>

      {/* Desktop / Table View with DndContext */}
      <div className="neu-border hidden overflow-x-auto md:block">
        <DndContext
          id={dndContextId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full font-mono text-sm" aria-label={ariaLabel}>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b-2 border-black bg-gray-50">
                  <SortableContext
                    items={sortableColumnIds}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header) => {
                      const isPinned = pinnedColumns.includes(header.id);
                      return (
                        <DraggableHeaderCell key={header.id} header={header} isPinned={isPinned} />
                      );
                    })}
                  </SortableContext>
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const trContent = (
                  <tr
                    key={row.id}
                    className="border-b border-black/10 last:border-b-0 hover:bg-gray-50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );

                if (renderRowContextMenu) {
                  return renderRowContextMenu(row.original, trContent);
                }
                return trContent;
              })}
            </tbody>
          </table>
        </DndContext>
      </div>

      {/* Mobile Stacked View */}
      <div className="space-y-3 md:hidden">
        {table.getRowModel().rows.map((row) => {
          const cardContent = (
            <div key={row.id} className="neu-border bg-gray-50 p-4 space-y-3">
              {row.getVisibleCells().map((cell) => (
                <div key={cell.id} className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] font-bold uppercase text-gray-500">
                    {cell.column.columnDef.header?.toString()}
                  </span>
                  <div>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                </div>
              ))}
            </div>
          );

          if (renderRowContextMenu) {
            return renderRowContextMenu(row.original, cardContent);
          }
          return cardContent;
        })}
      </div>

      {/* Manage Columns Modal */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="neu-border w-full max-w-md bg-white p-5 shadow-[6px_6px_0_0_#000] space-y-4 font-mono">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="font-black text-sm uppercase">Manage Column Order</h3>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="neu-border p-1 hover:bg-gray-100"
                aria-label="Close manage columns modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Reorder columns using the buttons below to customize your layout. Preference is saved
              automatically.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {columnOrder.map((colId, index) => {
                const headerObj = visibleHeaders.find((h) => h.id === colId);
                const title = headerObj?.column.columnDef.header?.toString() || colId;
                const isPinned = pinnedColumns.includes(colId);

                return (
                  <div
                    key={colId}
                    className="neu-border flex items-center justify-between bg-gray-50 p-2.5 text-xs font-bold"
                  >
                    <span className="capitalize">
                      {title} {isPinned && "(Pinned)"}
                    </span>

                    {!isPinned && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveColumn(colId, "up")}
                          disabled={index === 0}
                          aria-label={`Move ${title} up`}
                          className="neu-border bg-white p-1 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveColumn(colId, "down")}
                          disabled={index === columnOrder.length - 1}
                          aria-label={`Move ${title} down`}
                          className="neu-border bg-white p-1 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="neu-border bg-black text-white px-4 py-2 text-xs font-bold uppercase hover:bg-gray-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
