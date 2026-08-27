import React, { useState, useMemo, useRef, forwardRef, useId } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useVirtualizer } from "@tanstack/react-virtual";
import Check from "lucide-react/dist/esm/icons/check";
import ChevronsUpDown from "lucide-react/dist/esm/icons/chevrons-up-down";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface ComboboxOption {
  value: string;
  label: string;
  [key: string]: unknown;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  emptyStateMessage?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Unified Accessible Combobox Component
 *
 * Features:
 * - Built on Radix UI Popover and cmdk for absolute ARIA accessibility.
 * - Local filtering logic using `.includes()` (case-insensitive).
 * - Conditional Virtualization: Uses `@tanstack/react-virtual` if options.length > 100
 *   to prevent browser freezing from excessive DOM nodes.
 * - Seamless React Hook Form & custom state integration.
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
      estimateSize: () => 40,
      overscan: 5,
    });

    const selectedOption = options.find((opt) => opt.value === value);

    const handleSelect = (selectedVal: string) => {
      onValueChange?.(selectedVal);
      setOpen(false);
      setInputValue("");
    };

    const virtualItems = virtualizer.getVirtualItems();
    // Fallback for test/JSDOM environments where container height is 0
    const itemsToRender =
      shouldVirtualize && virtualItems.length === 0
        ? filteredOptions.slice(0, 20).map((opt, i) => ({
            index: i,
            start: i * 40,
            option: opt,
          }))
        : virtualItems.map((vi) => ({
            index: vi.index,
            start: vi.start,
            option: filteredOptions[vi.index],
          }));

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
            className="z-50 w-[--radix-popover-trigger-width] min-w-[240px] rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
            align="start"
            sideOffset={4}
          >
            <Command shouldFilter={false} className="bg-transparent">
              <CommandInput
                ref={ref}
                name={name}
                placeholder={`Search ${placeholder.toLowerCase()}...`}
                value={inputValue}
                onValueChange={setInputValue}
              />

              <CommandList
                ref={listRef}
                id={componentId}
                className="max-h-[300px] overflow-y-auto overflow-x-hidden"
              >
                {filteredOptions.length === 0 ? (
                  <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                    {emptyStateMessage}
                  </CommandEmpty>
                ) : (
                  <CommandGroup>
                    {shouldVirtualize ? (
                      <div
                        style={{
                          height: `${virtualizer.getTotalSize() || filteredOptions.length * 40}px`,
                          width: "100%",
                          position: "relative",
                        }}
                      >
                        {itemsToRender.map(({ index, start, option }) => {
                          if (!option) return null;
                          const isSelected = value === option.value;
                          return (
                            <div
                              key={option.value}
                              data-index={index}
                              ref={virtualizer.measureElement}
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                transform: `translateY(${start}px)`,
                              }}
                            >
                              <CommandItem
                                value={option.value}
                                onSelect={() => handleSelect(option.value)}
                                className="flex cursor-pointer select-none items-center justify-between px-4 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                              >
                                <span className="truncate">{option.label}</span>
                                {isSelected && <Check className="ml-auto h-4 w-4 text-primary" />}
                              </CommandItem>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      filteredOptions.map((option) => {
                        const isSelected = value === option.value;
                        return (
                          <CommandItem
                            key={option.value}
                            value={option.value}
                            onSelect={() => handleSelect(option.value)}
                            className="flex cursor-pointer select-none items-center justify-between px-4 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                          >
                            <span className="truncate">{option.label}</span>
                            {isSelected && <Check className="ml-auto h-4 w-4 text-primary" />}
                          </CommandItem>
                        );
                      })
                    )}
                  </CommandGroup>
                )}
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
