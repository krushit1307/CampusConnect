import React from "react";
import { Command } from "cmdk";
import { useMultiSelectContext } from "./hooks";
import { MultiSelectItem } from "./MultiSelectItem";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";

export function MultiSelectList() {
  const { availableOptions, inputValue, allowCustom, selected, addTag, setInputValue } =
    useMultiSelectContext();

  const exactMatch =
    availableOptions.some((opt) => opt.value.toLowerCase() === inputValue.trim().toLowerCase()) ||
    selected.some((opt) => opt.value.toLowerCase() === inputValue.trim().toLowerCase());

  const showCustom = allowCustom && inputValue.trim() !== "" && !exactMatch;

  return (
    <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden">
      {!showCustom && <EmptyState />}
      {/* If we needed async loading, we would conditionally render LoadingState here */}
      <Command.Group className="overflow-hidden p-1 text-foreground">
        {availableOptions.map((tag) => (
          <MultiSelectItem key={tag.value} tag={tag} />
        ))}
        {showCustom && (
          <Command.Item
            value={inputValue.trim()}
            onSelect={() => {
              addTag({ value: inputValue.trim(), label: inputValue.trim() });
              setInputValue("");
            }}
            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 font-bold text-violet-900"
          >
            Create "{inputValue.trim()}"
          </Command.Item>
        )}
      </Command.Group>
    </Command.List>
  );
}
