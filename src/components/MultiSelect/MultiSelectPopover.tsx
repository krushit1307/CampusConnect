import React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { useMultiSelectContext } from "./hooks";
import { MultiSelectList } from "./MultiSelectList";
import { cn } from "../../lib/utils";

export function MultiSelectPopover() {
  const { inputValue, setInputValue, selected, removeTag } = useMultiSelectContext();

  /**
   * Handles keyboard interaction inside the search input.
   *
   * When the input is empty and the caret is at the beginning,
   * pressing Backspace removes the most recently selected tag.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === "Backspace" &&
      inputValue === "" &&
      e.currentTarget.selectionStart === 0 &&
      selected.length > 0
    ) {
      removeTag(selected[selected.length - 1]);
    }
  };
  return (
    <Popover.Portal>
      <Popover.Content
        align="start"
        className={cn(
          "z-50 w-full min-w-[200px] rounded-md border bg-popover text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          "p-0",
        )}
        style={{ width: "var(--radix-popover-trigger-width)" }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command
          className="flex h-full w-full flex-col overflow-hidden rounded-md bg-transparent"
          shouldFilter={true}
        >
          <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
            <Command.Input
              placeholder="Search..."
              value={inputValue}
              onValueChange={setInputValue}
              onKeyDown={handleKeyDown}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <MultiSelectList />
        </Command>
      </Popover.Content>
    </Popover.Portal>
  );
}
