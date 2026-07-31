import React from "react";
import { Command } from "cmdk";
import { Tag } from "./types";
import { cn } from "../../lib/utils";
import { useMultiSelectContext } from "./hooks";

interface MultiSelectItemProps {
  tag: Tag;
}

export function MultiSelectItem({ tag }: MultiSelectItemProps) {
  const { addTag, setInputValue } = useMultiSelectContext();

  return (
    <Command.Item
      value={tag.label}
      onSelect={() => {
        addTag(tag);
        setInputValue("");
      }}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
        "aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {tag.label}
    </Command.Item>
  );
}
