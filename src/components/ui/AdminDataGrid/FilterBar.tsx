import React, { useState, useCallback } from "react";
import { type Column, type ColumnDef } from "@tanstack/react-table";
import PlusCircle from "lucide-react/dist/esm/icons/plus-circle";
import X from "lucide-react/dist/esm/icons/x";
import Filter from "lucide-react/dist/esm/icons/filter";

export type FilterOperator =
  "contains" | "equals" | "startsWith" | "endsWith" | "isEmpty" | "isNotEmpty";

export interface FilterRule {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: string;
}

interface FilterBarProps<TData> {
  columns: Column<TData, unknown>[];
  filterRules: FilterRule[];
  onFilterRulesChange: (rules: FilterRule[]) => void;
}

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "equals" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "isEmpty", label: "is empty" },
  { value: "isNotEmpty", label: "is not empty" },
];

function nanoid() {
  return Math.random().toString(36).slice(2, 10);
}

export function FilterBar<TData>({
  columns,
  filterRules,
  onFilterRulesChange,
}: FilterBarProps<TData>) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftColumnId, setDraftColumnId] = useState(columns[0]?.id ?? "");
  const [draftOperator, setDraftOperator] = useState<FilterOperator>("contains");
  const [draftValue, setDraftValue] = useState("");

  const filterableColumns = columns.filter((col) => col.id !== "select" && col.id !== "actions");

  const handleAddFilter = useCallback(() => {
    if (!draftColumnId) return;
    const rule: FilterRule = {
      id: nanoid(),
      columnId: draftColumnId,
      operator: draftOperator,
      value: draftOperator === "isEmpty" || draftOperator === "isNotEmpty" ? "" : draftValue,
    };
    onFilterRulesChange([...filterRules, rule]);
    setDraftValue("");
    setIsOpen(false);
  }, [draftColumnId, draftOperator, draftValue, filterRules, onFilterRulesChange]);

  const handleRemoveFilter = useCallback(
    (id: string) => {
      onFilterRulesChange(filterRules.filter((r) => r.id !== id));
    },
    [filterRules, onFilterRulesChange],
  );

  const noValueNeeded = draftOperator === "isEmpty" || draftOperator === "isNotEmpty";

  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
      {/* Active filter pills */}
      {filterRules.map((rule) => {
        const col = filterableColumns.find((c) => c.id === rule.columnId);
        const colLabel = col
          ? String(
              (col.columnDef as ColumnDef<TData, unknown> & { header?: string }).header ?? col.id,
            )
          : rule.columnId;
        const opLabel = OPERATORS.find((o) => o.value === rule.operator)?.label ?? rule.operator;

        return (
          <span
            key={rule.id}
            data-testid={`filter-pill-${rule.id}`}
            className="inline-flex items-center gap-1.5 bg-lime border-2 border-black px-2 py-1 font-bold shadow-[2px_2px_0_0_#000]"
          >
            <Filter className="h-3 w-3 shrink-0" />
            <span className="capitalize">{colLabel}</span>
            <span className="text-gray-700 font-normal">{opLabel}</span>
            {rule.value && <span>&quot;{rule.value}&quot;</span>}
            <button
              type="button"
              aria-label={`Remove filter on ${colLabel}`}
              onClick={() => handleRemoveFilter(rule.id)}
              className="ml-1 text-black hover:text-red-700 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      {/* Add filter trigger */}
      <div className="relative">
        <button
          type="button"
          id="add-filter-btn"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          onClick={() => setIsOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 border-2 border-black bg-white px-2.5 py-1 font-bold uppercase hover:bg-gray-100 shadow-[2px_2px_0_0_#000] transition-colors"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Add Filter
        </button>

        {isOpen && (
          <div
            role="dialog"
            aria-label="Add filter rule"
            className="absolute left-0 top-full mt-1 z-50 w-80 bg-white border-2 border-black shadow-[4px_4px_0_0_#000] p-4 space-y-3"
          >
            {/* Column selector */}
            <div className="space-y-1">
              <label
                htmlFor="filter-column-select"
                className="font-bold uppercase text-[10px] text-gray-600"
              >
                Column
              </label>
              <select
                id="filter-column-select"
                value={draftColumnId}
                onChange={(e) => setDraftColumnId(e.target.value)}
                className="w-full border-2 border-black bg-white px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-black"
              >
                {filterableColumns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {String(
                      (col.columnDef as ColumnDef<TData, unknown> & { header?: string }).header ??
                        col.id,
                    )}
                  </option>
                ))}
              </select>
            </div>

            {/* Operator selector */}
            <div className="space-y-1">
              <label
                htmlFor="filter-operator-select"
                className="font-bold uppercase text-[10px] text-gray-600"
              >
                Operator
              </label>
              <select
                id="filter-operator-select"
                value={draftOperator}
                onChange={(e) => setDraftOperator(e.target.value as FilterOperator)}
                className="w-full border-2 border-black bg-white px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-black"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Value input */}
            {!noValueNeeded && (
              <div className="space-y-1">
                <label
                  htmlFor="filter-value-input"
                  className="font-bold uppercase text-[10px] text-gray-600"
                >
                  Value
                </label>
                <input
                  id="filter-value-input"
                  type="text"
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddFilter()}
                  placeholder="Filter value..."
                  className="w-full border-2 border-black bg-white px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-1 border-t-2 border-black">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold uppercase text-gray-500 hover:text-black transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="apply-filter-btn"
                onClick={handleAddFilter}
                disabled={!noValueNeeded && !draftValue.trim()}
                className="border-2 border-black bg-black text-white px-3 py-1.5 text-xs font-bold uppercase hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[2px_2px_0_0_#000]"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Clear all */}
      {filterRules.length > 0 && (
        <button
          type="button"
          onClick={() => onFilterRulesChange([])}
          className="text-xs font-bold uppercase text-gray-500 hover:text-red-700 transition-colors underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
