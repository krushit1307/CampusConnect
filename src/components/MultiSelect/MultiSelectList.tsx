import React from "react";
import { Command } from "cmdk";
import { useMultiSelectContext } from "./hooks";
import { MultiSelectItem } from "./MultiSelectItem";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";

export function MultiSelectList() {
  const { availableOptions } = useMultiSelectContext();

  return (
    <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden">
      <EmptyState />
      {/* If we needed async loading, we would conditionally render LoadingState here */}
      <Command.Group className="overflow-hidden p-1 text-foreground">
        {availableOptions.map((tag) => (
          <MultiSelectItem key={tag.value} tag={tag} />
        ))}
      </Command.Group>
    </Command.List>
  );
}
