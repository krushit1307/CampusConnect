import React, { useRef, useState, useEffect, useCallback, useId } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type ColumnSizingState,
  type ColumnOrderState,
  type VisibilityState,
  type FilterFn,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import ArrowUp from "lucide-react/dist/esm/icons/arrow-up";
import ArrowDown from "lucide-react/dist/esm/icons/arrow-down";
import ArrowUpDown from "lucide-react/dist/esm/icons/arrow-up-down";
import Download from "lucide-react/dist/esm/icons/download";
import Eye from "lucide-react/dist/esm/icons/eye";
import EyeOff from "lucide-react/dist/esm/icons/eye-off";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";
import X from "lucide-react/dist/esm/icons/x";
import { FilterBar, type FilterRule, type FilterOperator } from "./FilterBar";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent } from "@/components/ui/context-menu";
import { useHasTextSelection } from "@/hooks/useHasTextSelection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminDataGridProps<TData> {
  /** Unique ID for localStorage key namespacing. */
  tableId: string;
  /** Flat data array — supports 10 000+ rows via row virtualization. */
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  isLoading?: boolean;
  ariaLabel?: string;
  /** Column IDs excluded from reorder/resize (e.g. "select", "actions"). */
  pinnedColumns?: string[];
  onRowClick?: (row: TData) => void;
  exportFilename?: string;
  /**
   * Renders the contents of a per-row right-click context menu (quick
   * actions like Edit / Delete / Copy ID). Return `ContextMenuItem`
   * elements from "@/components/ui/context-menu". When omitted, rows fall
   * back to the browser's native context menu.
   */
  renderRowContextMenu?: (row: TData) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Custom filter functions
// ---------------------------------------------------------------------------

const customFilterFn: FilterFn<unknown> = (row, columnId, filterValue: FilterRule) => {
  const cellValue = String(row.getValue(columnId) ?? "").toLowerCase();
  const value = filterValue.value.toLowerCase();
  switch (filterValue.operator as FilterOperator) {
    case "contains":
      return cellValue.includes(value);
    case "equals":
      return cellValue === value;
    case "startsWith":
      return cellValue.startsWith(value);
    case "endsWith":
      return cellValue.endsWith(value);
    case "isEmpty":
      return cellValue === "" || cellValue === "null" || cellValue === "undefined";
    case "isNotEmpty":
      return cellValue !== "" && cellValue !== "null" && cellValue !== "undefined";
    default:
      return true;
  }
};

// ---------------------------------------------------------------------------
// Sortable header cell (drag handle + resize handle + sort indicator)
// ---------------------------------------------------------------------------

interface SortableHeaderCellProps<TData> {
  header: import("@tanstack/react-table").Header<TData, unknown>;
  isPinned: boolean;
  onResizeStart: (columnId: string, startX: number, startSize: number) => void;
}

function SortableHeaderCell<TData>({
  header,
  isPinned,
  onResizeStart,
}: SortableHeaderCellProps<TData>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.id,
    disabled: isPinned,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 1,
    width: header.getSize(),
    minWidth: 60,
    position: "relative",
  };

  const sorted = header.column.getIsSorted();

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`p-0 text-left text-xs font-black uppercase select-none border-b-4 border-black bg-gray-50 whitespace-nowrap ${
        isDragging ? "bg-amber-100 shadow-md" : ""
      } ${header.column.getCanSort() ? "cursor-pointer" : ""}`}
    >
      <div
        className="flex items-center gap-1.5 px-3 py-3 pr-6"
        onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            header.column.getToggleSortingHandler()?.(e);
          }
        }}
        tabIndex={header.column.getCanSort() ? 0 : undefined}
        role={header.column.getCanSort() ? "button" : undefined}
        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
      >
        {/* Drag handle */}
        {!isPinned && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder column ${header.id}`}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing p-0.5 text-gray-300 hover:text-black transition-colors rounded shrink-0"
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}

        {/* Header label */}
        <span className="truncate flex-1">
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </span>

        {/* Sort indicator */}
        {header.column.getCanSort() && (
          <span className="shrink-0 text-gray-400">
            {sorted === "asc" ? (
              <ArrowUp className="h-3 w-3 text-black" />
            ) : sorted === "desc" ? (
              <ArrowDown className="h-3 w-3 text-black" />
            ) : (
              <ArrowUpDown className="h-3 w-3" />
            )}
          </span>
        )}
      </div>

      {/* Resize handle */}
      {header.column.getCanResize() && !isPinned && (
        <div
          role="separator"
          aria-label={`Resize column ${header.id}`}
          className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-center group"
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(header.id, e.clientX, header.getSize());
          }}
        >
          <div className="w-px h-4/5 bg-black/20 group-hover:bg-black transition-colors" />
        </div>
      )}
    </th>
  );
}

// ---------------------------------------------------------------------------
// Skeleton shimmer row
// ---------------------------------------------------------------------------

function SkeletonRow({ colCount }: { colCount: number }) {
  return (
    <tr className="border-b border-black/10 animate-pulse">
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------

function exportToCsv<TData>(
  rows: import("@tanstack/react-table").Row<TData>[],
  columns: ColumnDef<TData, unknown>[],
  filename: string,
) {
  const headers = columns
    .filter((col) => col.id !== "select" && col.id !== "actions")
    .map((col) => String(col.header ?? col.id ?? ""))
    .join(",");

  const body = rows
    .map((row) =>
      columns
        .filter((col) => col.id !== "select" && col.id !== "actions")
        .map((col) => {
          const key = (col as { accessorKey?: string }).accessorKey ?? col.id ?? "";
          const val = row.getValue(key) ?? "";
          const strVal = String(val).replace(/"/g, '""');
          return `"${strVal}"`;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob([`${headers}\n${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Main AdminDataGrid component
// ---------------------------------------------------------------------------

export function AdminDataGrid<TData>({
  tableId,
  data,
  columns,
  isLoading = false,
  ariaLabel = "Admin Data Grid",
  pinnedColumns = ["select", "actions"],
  onRowClick,
  exportFilename = "export",
  renderRowContextMenu,
}: AdminDataGridProps<TData>) {
  const dndId = useId();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Text selection in progress → defer to the browser's native context menu
  // (e.g. so "Copy" on a highlighted cell value still works).
  const hasTextSelection = useHasTextSelection();

  // --- Persisted state keys ---
  const sizingKey = `admin_grid_sizing_${tableId}`;
  const orderKey = `admin_grid_order_${tableId}`;
  const visKey = `admin_grid_vis_${tableId}`;

  // --- Table state ---
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    try {
      const saved = localStorage.getItem(sizingKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => {
    try {
      const saved = localStorage.getItem(orderKey);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return columns.map((col) => col.id ?? (col as { accessorKey?: string }).accessorKey ?? "");
  });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      const saved = localStorage.getItem(visKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isVisMenuOpen, setIsVisMenuOpen] = useState(false);

  // Persist sizing + visibility
  useEffect(() => {
    try {
      localStorage.setItem(sizingKey, JSON.stringify(columnSizing));
    } catch {
      // ignore
    }
  }, [columnSizing, sizingKey]);

  useEffect(() => {
    try {
      localStorage.setItem(orderKey, JSON.stringify(columnOrder));
    } catch {
      // ignore
    }
  }, [columnOrder, orderKey]);

  useEffect(() => {
    try {
      localStorage.setItem(visKey, JSON.stringify(columnVisibility));
    } catch {
      // ignore
    }
  }, [columnVisibility, visKey]);

  // --- Sync filter rules → TanStack columnFilters ---
  useEffect(() => {
    // Group rules by columnId and build ColumnFiltersState
    // We store all rules for a column as an array in one ColumnFilter entry
    const grouped = new Map<string, FilterRule[]>();
    for (const rule of filterRules) {
      if (!grouped.has(rule.columnId)) grouped.set(rule.columnId, []);
      grouped.get(rule.columnId)!.push(rule);
    }
    const newFilters: ColumnFiltersState = Array.from(grouped.entries()).map(
      ([columnId, rules]) => ({
        id: columnId,
        // Pass first rule (future: AND chain); TanStack filterFn receives this value
        value: rules[0],
      }),
    );
    setColumnFilters(newFilters);
  }, [filterRules]);

  // --- Column resize via mouse drag ---
  const resizingRef = useRef<{
    columnId: string;
    startX: number;
    startSize: number;
  } | null>(null);

  const handleResizeStart = useCallback((columnId: string, startX: number, startSize: number) => {
    resizingRef.current = { columnId, startX, startSize };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = e.clientX - resizingRef.current.startX;
      const newSize = Math.max(60, resizingRef.current.startSize + delta);
      setColumnSizing((prev) => ({ ...prev, [resizingRef.current!.columnId]: newSize }));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  // --- TanStack Table ---
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnSizing,
      columnOrder,
      columnVisibility,
    },
    filterFns: {
      custom: customFilterFn as FilterFn<TData>,
    },
    defaultColumn: {
      size: 150,
      minSize: 60,
      maxSize: 600,
      filterFn: "custom" as never,
    },
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableMultiSort: true,
  });

  // --- Row virtualizer ---
  const { rows } = table.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 45,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0) : 0;

  // --- DnD column reorder ---
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((order) => {
        const oldIdx = order.indexOf(active.id as string);
        const newIdx = order.indexOf(over.id as string);
        return arrayMove(order, oldIdx, newIdx);
      });
    }
  };

  const sortableColumnIds = columnOrder.filter((id) => !pinnedColumns.includes(id));
  const headerGroups = table.getHeaderGroups();
  const visibleCols = table
    .getAllLeafColumns()
    .filter((c) => c.id !== "select" && c.id !== "actions");

  return (
    <div className="space-y-3 font-mono text-sm" data-testid={`admin-data-grid-${tableId}`}>
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: row count + filter rules */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase text-gray-500">
            {rows.length.toLocaleString()}
            {rows.length !== data.length && ` / ${data.length.toLocaleString()}`} rows
          </span>
          <FilterBar<TData>
            columns={table.getAllLeafColumns()}
            filterRules={filterRules}
            onFilterRulesChange={setFilterRules}
          />
        </div>

        {/* Right: visibility + export */}
        <div className="flex items-center gap-2">
          {/* Column visibility toggle */}
          <div className="relative">
            <button
              type="button"
              id={`col-visibility-btn-${tableId}`}
              onClick={() => setIsVisMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 border-2 border-black bg-white px-2.5 py-1.5 text-xs font-bold uppercase hover:bg-gray-100 shadow-[2px_2px_0_0_#000] transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              Columns
            </button>

            {isVisMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white border-2 border-black shadow-[4px_4px_0_0_#000] p-3 space-y-2">
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <span className="text-[10px] font-black uppercase">Toggle Columns</span>
                  <button
                    type="button"
                    onClick={() => setIsVisMenuOpen(false)}
                    aria-label="Close visibility menu"
                    className="hover:bg-gray-100 p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {visibleCols.map((col) => {
                  const isVisible = col.getIsVisible();
                  return (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 cursor-pointer text-xs font-medium hover:bg-gray-50 px-1 py-0.5"
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => col.toggleVisibility()}
                        className="h-3.5 w-3.5 accent-black cursor-pointer"
                      />
                      <span className="capitalize flex-1">
                        {String(
                          (col.columnDef as ColumnDef<TData, unknown> & { header?: string })
                            .header ?? col.id,
                        )}
                      </span>
                      {isVisible ? (
                        <Eye className="h-3 w-3 text-gray-400" />
                      ) : (
                        <EyeOff className="h-3 w-3 text-gray-300" />
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Export CSV */}
          <button
            type="button"
            id={`export-csv-btn-${tableId}`}
            onClick={() => exportToCsv(rows, columns, exportFilename)}
            className="inline-flex items-center gap-1.5 border-2 border-black bg-black text-white px-2.5 py-1.5 text-xs font-bold uppercase hover:bg-gray-800 shadow-[2px_2px_0_0_#000] transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Grid Container ─────────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        style={{ height: 600, overflowY: "auto", overflowX: "auto" }}
        className="border-2 border-black shadow-[4px_4px_0_0_#000] bg-white relative"
      >
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
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
          <table
            className="w-full border-collapse table-fixed"
            aria-label={ariaLabel}
            style={{ minWidth: table.getTotalSize() }}
          >
            {/* ── Sticky Header ──────────────────────────────────── */}
            <thead className="sticky top-0 z-20">
              {headerGroups.map((hg) => (
                <tr key={hg.id} className="border-b-4 border-black bg-gray-50">
                  <SortableContext
                    items={sortableColumnIds}
                    strategy={horizontalListSortingStrategy}
                  >
                    {hg.headers.map((header) => (
                      <SortableHeaderCell
                        key={header.id}
                        header={header}
                        isPinned={pinnedColumns.includes(header.id)}
                        onResizeStart={handleResizeStart}
                      />
                    ))}
                  </SortableContext>
                </tr>
              ))}
            </thead>

            {/* ── Body ───────────────────────────────────────────── */}
            <tbody>
              {/* Loading skeletons */}
              {isLoading && data.length === 0 ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <SkeletonRow key={i} colCount={columns.length} />
                ))
              ) : rows.length === 0 ? (
                /* Empty state */
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-16 text-center text-gray-500 font-bold uppercase"
                    data-testid="empty-state"
                  >
                    <div className="space-y-2">
                      <p>No results found.</p>
                      {filterRules.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFilterRules([])}
                          className="text-xs underline hover:text-black transition-colors"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: paddingTop }} />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    const rowElement = (
                      <tr
                        key={row.id}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                        className={`border-b border-black/10 transition-colors ${
                          onRowClick ? "cursor-pointer hover:bg-gray-50" : "hover:bg-gray-50/50"
                        }`}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            style={{
                              width: cell.column.getSize(),
                              maxWidth: cell.column.getSize(),
                            }}
                            className="px-3 py-2.5 truncate"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );

                    if (!renderRowContextMenu) return rowElement;

                    return (
                      <ContextMenu key={row.id}>
                        {/*
                          `disabled` is the load-bearing bit here: when the user
                          is mid-selection (e.g. highlighting a cell's text to
                          copy it), we back off entirely so the browser's native
                          Copy/Paste menu appears instead of ours.
                        */}
                        <ContextMenuTrigger asChild disabled={hasTextSelection}>
                          {rowElement}
                        </ContextMenuTrigger>
                        <ContextMenuContent className="min-w-[10rem] rounded-none border-2 border-black bg-white p-1 font-mono text-xs font-bold uppercase text-black shadow-[4px_4px_0_0_#000]">
                          {renderRowContextMenu(row.original)}
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: paddingBottom }} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </DndContext>

        {/* Overlay spinner while refreshing with existing data */}
        {isLoading && data.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-30">
            <Loader2 className="h-8 w-8 animate-spin text-black" />
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-gray-500 font-bold uppercase">
        <span>
          Showing {virtualRows.length.toLocaleString()} of {rows.length.toLocaleString()} rows
          (virtual window)
        </span>
        {sorting.length > 0 && (
          <button
            type="button"
            onClick={() => setSorting([])}
            className="text-xs underline hover:text-black transition-colors"
          >
            Clear sort
          </button>
        )}
      </div>
    </div>
  );
}
