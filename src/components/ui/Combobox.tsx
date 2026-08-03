import React, { useState, useMemo, useRef, forwardRef, useId } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils"; // Adjust path to your cn utility
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"; // Assuming shadcn/ui command exists, or fallback to custom

export interface ComboboxOption {
  value: string;
  label: string;
  // Allow additional metadata if needed
  [key: string]: any;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  emptyStateMessage?: string;
  name?: string; // For React Hook Form integration
  disabled?: boolean;
  className?: string;
}

/**
 * Unified Accessible Combobox Component
 *
 * Features:
 * - Built on Radix UI Popover for absolute ARIA accessibility.
 * - Local filtering logic using `.includes()` (case-insensitive).
 * - Conditional Virtualization: Uses `@tanstack/react-virtual` if options.length > 100
 *   to prevent browser freezing from excessive DOM nodes.
 * - Seamless React Hook Form integration via `name` and `forwardRef`.
 * - Full keyboard navigation support (Arrow keys, Enter, Escape).
 */
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = "Select an option...",
      emptyStateMessage = "No matching options found.",
      name,
      disabled = false,
      className,
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const componentId = useId();
    const listRef = useRef<HTMLDivElement>(null);

    // Filter options based on input value
    const filteredOptions = useMemo(() => {
      if (!inputValue) return options;
      const lowerQuery = inputValue.toLowerCase();
      return options.filter((option) => option.label.toLowerCase().includes(lowerQuery));
    }, [options, inputValue]);

    // Determine if we need virtualization (> 100 items)
    const shouldVirtualize = filteredOptions.length > 100;

    // Setup virtualizer only if needed
    const virtualizer = useVirtualizer({
      count: shouldVirtualize ? filteredOptions.length : 0,
      getScrollElement: () => listRef.current,
      estimateSize: () => 40, // Estimated height of each item in pixels
      overscan: 5,
    });

    const selectedOption = options.find((opt) => opt.value === value);

    const handleSelect = (currentValue: string) => {
      const newValue = currentValue === value ? "" : currentValue;
      onValueChange?.(newValue);
      setOpen(false);
      setInputValue(""); // Clear search on selection
    };

    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-controls={componentId}
            aria-haspopup="listbox"
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="z-50 w-[--radix-popover-trigger-width] rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
            align="start"
            sideOffset={4}
          >
            <Command className="bg-transparent">
              <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <CommandInput
                  ref={ref}
                  name={name}
                  placeholder={`Search ${placeholder.toLowerCase()}...`}
                  value={inputValue}
                  onValueChange={setInputValue}
                  className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <CommandList
                ref={listRef}
                className="max-h-[300px] overflow-y-auto overflow-x-hidden"
              >
                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                  {emptyStateMessage}
                </CommandEmpty>

                <CommandGroup>
                  {shouldVirtualize ? (
                    // VIRTUALIZED RENDER PATH: For > 100 items
                    <div
                      style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: "100%",
                        position: "relative",
                      }}
                    >
                      {virtualizer.getVirtualItems().map((virtualItem) => {
                        const option = filteredOptions[virtualItem.index];
                        const isSelected = value === option.value;
                        return (
                          <div
                            key={option.value}
                            data-index={virtualItem.index}
                            ref={virtualizer.measureElement}
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              transform: `translateY(${virtualItem.start}px)`,
                            }}
                          >
                            <CommandItem
                              value={option.value}
                              onSelect={() => handleSelect(option.value)}
                              className="flex cursor-default select-none items-center justify-between px-4 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                            >
                              <span className="truncate">{option.label}</span>
                              {isSelected && <Check className="ml-auto h-4 w-4 text-primary" />}
                            </CommandItem>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // STANDARD RENDER PATH: For <= 100 items
                    filteredOptions.map((option) => {
                      const isSelected = value === option.value;
                      return (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={() => handleSelect(option.value)}
                          className="flex cursor-default select-none items-center justify-between px4 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                        >
                          <span className="truncate">{option.label}</span>
                          {isSelected && <Check className="ml-auto h-4 w-4 text-primary" />}
                        </CommandItem>
                      );
                    })
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  },
);

Combobox.displayName = "Combobox";

export default Combobox;
