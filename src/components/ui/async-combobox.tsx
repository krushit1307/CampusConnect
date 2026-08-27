import React, { useState, useEffect, useRef, useId } from "react";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Search from "lucide-react/dist/esm/icons/search";
import X from "lucide-react/dist/esm/icons/x";
import Check from "lucide-react/dist/esm/icons/check";
import { useDebounce } from "@/hooks/useDebounce";
import { HighlightText } from "./HighlightText";
import { cn } from "@/lib/utils";

export interface AsyncComboboxProps<T> {
  fetchOptions: (query: string, signal?: AbortSignal) => Promise<T[]>;
  onSelect: (item: T) => void;
  getOptionLabel: (item: T) => string;
  getOptionValue: (item: T) => string;
  renderOption?: (item: T, searchQuery: string) => React.ReactNode;
  placeholder?: string;
  debounceMs?: number;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  emptyText?: string;
  ariaLabel?: string;
}

/**
 * Accessible Asynchronous Combobox Component (#1735)
 *
 * Features:
 * - 300ms debounced backend search using `useDebounce`.
 * - Automatic AbortController request cancellation to prevent race conditions.
 * - Dynamic ARIA accessibility (role="combobox", aria-expanded, aria-controls, aria-activedescendant).
 * - Full keyboard navigation (ArrowUp, ArrowDown, Enter, Escape).
 * - Automatic substring text highlighting in option results for fast visual scanning via `HighlightText`.
 */
export function AsyncCombobox<T>({
  fetchOptions,
  onSelect,
  getOptionLabel,
  getOptionValue,
  renderOption,
  placeholder = "Search...",
  debounceMs = 300,
  disabled = false,
  className,
  inputClassName,
  emptyText = "No matching results found.",
  ariaLabel = "Search and select option",
}: AsyncComboboxProps<T>) {
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);

  const debouncedQuery = useDebounce(inputValue, debounceMs);
  const componentId = useId();
  const listboxId = `async-combobox-listbox-${componentId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch options when debounced query changes
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!debouncedQuery.trim()) {
      setOptions([]);
      setIsLoading(false);
      setFocusedIndex(-1);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    fetchOptions(debouncedQuery, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setOptions(data || []);
          setIsLoading(false);
          setIsOpen(true);
          setFocusedIndex(-1);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("AsyncCombobox fetch error:", err);
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, fetchOptions]);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleSelectItem = (item: T) => {
    setSelectedItem(item);
    setInputValue(getOptionLabel(item));
    setIsOpen(false);
    onSelect(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      if (options.length > 0) {
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (e.key === "Enter") {
      if (isOpen && focusedIndex >= 0 && focusedIndex < options.length) {
        e.preventDefault();
        handleSelectItem(options[focusedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const optionId = (idx: number) => `async-combobox-option-${componentId}-${idx}`;

  return (
    <div ref={containerRef} className={cn("relative w-full font-mono", className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={isOpen && focusedIndex >= 0 ? optionId(focusedIndex) : undefined}
          value={inputValue}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!isOpen && e.target.value.trim()) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (options.length > 0 || inputValue.trim()) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full pl-9 pr-9 py-2 neu-border bg-white text-black font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-black",
            inputClassName,
          )}
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 w-4 h-4 text-gray-500 animate-spin" />
        ) : inputValue ? (
          <button
            type="button"
            onClick={() => {
              setInputValue("");
              setOptions([]);
              setIsOpen(false);
              setFocusedIndex(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-3 p-0.5 text-gray-400 hover:text-black"
            aria-label="Clear input"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-50 neu-border bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-60 overflow-y-auto"
        >
          {isLoading && options.length === 0 ? (
            <div className="p-4 text-xs font-bold uppercase text-gray-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-lime" /> Searching users...
            </div>
          ) : options.length === 0 ? (
            <div className="p-4 text-xs font-bold uppercase text-gray-500 text-center">
              {emptyText}
            </div>
          ) : (
            options.map((item, index) => {
              const label = getOptionLabel(item);
              const val = getOptionValue(item);
              const isFocused = index === focusedIndex;
              const isSelected = selectedItem && getOptionValue(selectedItem) === val;

              return (
                <div
                  key={val}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  data-focused={isFocused}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={cn(
                    "px-4 py-2.5 cursor-pointer text-sm font-semibold flex items-center justify-between transition-colors border-b border-gray-100 last:border-b-0",
                    isFocused ? "bg-lime/20 text-black" : "hover:bg-cream/40",
                    isSelected && "bg-lime/40 font-bold",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    {renderOption ? (
                      renderOption(item, debouncedQuery)
                    ) : (
                      <HighlightText text={label} highlight={debouncedQuery} />
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-black shrink-0 ml-2" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
