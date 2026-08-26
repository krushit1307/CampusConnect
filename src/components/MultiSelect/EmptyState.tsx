import React from "react";
import { Command } from "cmdk";
import { useMultiSelectContext } from "./hooks";

export function EmptyState() {
  const { emptyText } = useMultiSelectContext();

  return (
    <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
      {emptyText}
    </Command.Empty>
  );
}
