import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface VirtualComboboxOption {
  value: string;
  label: string;
  render?: React.ReactNode;
}

interface VirtualComboboxProps {
  options: VirtualComboboxOption[];
  value?: string;
  onSelect?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  popoverClassName?: string;
}

export function VirtualCombobox({
  options,
  value,
  onSelect,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  className,
  popoverClassName,
}: VirtualComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const parentRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const lowerSearch = search.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(lowerSearch));
  }, [options, search]);

  const virtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  React.useEffect(() => {
    setActiveIndex(0);
    if (parentRef.current) {
      virtualizer.scrollToIndex(0);
    }
  }, [search, virtualizer]);

  React.useEffect(() => {
    if (open) {
      setSearch("");
      const selectedIndex = options.findIndex((opt) => opt.value === value);
      if (selectedIndex !== -1) {
        setActiveIndex(selectedIndex);
        // Delay scroll slightly to ensure Popover is fully rendered
        setTimeout(() => {
          virtualizer.scrollToIndex(selectedIndex, { align: "center" });
        }, 0);
      } else {
        setActiveIndex(0);
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [open, value, options, virtualizer]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredOptions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev: number) => {
        const next = Math.min(prev + 1, filteredOptions.length - 1);
        virtualizer.scrollToIndex(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev: number) => {
        const next = Math.max(prev - 1, 0);
        virtualizer.scrollToIndex(next);
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filteredOptions[activeIndex];
      if (option) {
        onSelect?.(option.value === value ? "" : option.value);
        setOpen(false);
      }
    }
  };

  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0 w-[300px]", popoverClassName)} align="start">
        <div
          className="flex flex-col overflow-hidden rounded-md bg-popover text-popover-foreground"
          onKeyDown={handleKeyDown}
        >
          {/* Search Input */}
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Virtualized List */}
          <div ref={parentRef} className="max-h-[300px] overflow-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">{emptyText}</div>
            ) : (
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const option = filteredOptions[virtualItem.index];
                  const isActive = activeIndex === virtualItem.index;
                  const isSelected = value === option.value;

                  return (
                    <div
                      key={option.value}
                      ref={virtualizer.measureElement}
                      data-index={virtualItem.index}
                      className={cn(
                        "absolute top-0 left-0 w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                        isActive && "bg-accent text-accent-foreground",
                        !isActive && isSelected && "bg-accent/50 text-accent-foreground",
                        "flex gap-2",
                      )}
                      style={{
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                      onMouseEnter={() => setActiveIndex(virtualItem.index)}
                      onClick={() => {
                        onSelect?.(isSelected ? "" : option.value);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                      />
                      <div className="flex-1 overflow-hidden">
                        {option.render || <span className="truncate">{option.label}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
