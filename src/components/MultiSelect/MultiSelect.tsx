import React, { useState, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import { MultiSelectProps, Tag } from "./types";
import { MultiSelectContext } from "./hooks";
import { MultiSelectTrigger } from "./MultiSelectTrigger";
import { MultiSelectPopover } from "./MultiSelectPopover";

/**
 * MultiSelect
 *
 * A reusable multi-select component built with Radix Popover and Cmdk.
 *
 * Features:
 * - Multiple selection
 * - Searchable options
 * - Optional custom value creation (`allowCustom`)
 * - Keyboard navigation
 * - Removable pill tags
 * - Backspace removes the last selected tag when the input is empty
 *
 * Used by:
 * - Event creation
 * - Event editing
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  emptyText = "No results found.",
  disabled = false,
  allowCustom = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const selected = value || [];

  // Options that are not currently selected
  const availableOptions = useMemo(() => {
    return options.filter((option) => !selected.some((s) => s.value === option.value));
  }, [options, selected]);

  const addTag = (tag: Tag) => {
    if (!selected.some((s) => s.value.toLowerCase() === tag.value.toLowerCase())) {
      onChange([...selected, tag]);
    }
  };

  const removeTag = (tag: Tag) => {
    onChange(selected.filter((s) => s.value !== tag.value));
  };

  const contextValue = {
    options,
    selected,
    availableOptions,
    addTag,
    removeTag,
    open,
    setOpen,
    inputValue,
    setInputValue,
    disabled,
    placeholder,
    emptyText,
    allowCustom,
  };

  return (
    <MultiSelectContext.Provider value={contextValue}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <div className="relative">
          <MultiSelectTrigger />
          <MultiSelectPopover />
        </div>
      </Popover.Root>
    </MultiSelectContext.Provider>
  );
}
