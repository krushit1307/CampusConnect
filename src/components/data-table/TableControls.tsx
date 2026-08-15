// =============================================================================
// Component: TableControls
// Issue: #2453 - High-performance SortableTable with multi-column sorting
// Description: Renders the toolbar above the table, including row count,
// loading indicator, and a "Reset Sort" button.
// =============================================================================

import React from "react";
import { Table } from "@tanstack/react-table";

interface TableControlsProps<TData> {
  table: Table<TData>;
  rowCount: number;
  isLoading: boolean;
}

export function TableControls<TData>({ table, rowCount, isLoading }: TableControlsProps<TData>) {
  const isSorted = table.getState().sorting.length > 0;

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing{" "}
          <span className="font-semibold text-gray-900 dark:text-white">
            {table.getRowModel().rows.length}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-gray-900 dark:text-white">
            {rowCount.toLocaleString()}
          </span>{" "}
          users
        </p>

        {isLoading && (
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-sm font-medium">Updating...</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isSorted && (
          <button
            onClick={() => table.resetSorting()}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Reset Sort
          </button>
        )}

        <button
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          title="Export to CSV"
        >
          <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export
        </button>
      </div>
    </div>
  );
}
