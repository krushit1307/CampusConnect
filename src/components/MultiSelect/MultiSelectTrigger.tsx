import React, { useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useMultiSelectContext } from "./hooks";
import { SelectedPill } from "./SelectedPill";
import { cn } from "../../lib/utils";

export const MultiSelectTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { selected, removeTag, open, setOpen, disabled, placeholder } = useMultiSelectContext();

  return (
    <Popover.Trigger asChild>
      <div
        ref={ref}
        role="combobox"
        aria-controls="radix-:r1:"
        aria-expanded={open}
        data-disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 cursor-pointer",
          "max-h-24 overflow-y-auto",
          className,
        )}
        onClick={() => {
          if (!disabled) setOpen(!open);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            setOpen(!open);
            e.preventDefault();
          }
          if (e.key === "Delete" || e.key === "Backspace") {
            if (selected.length > 0) {
              removeTag(selected[selected.length - 1]);
            }
          }
        }}
        tabIndex={disabled ? -1 : 0}
        {...props}
      >
        <div className="flex flex-wrap gap-1">
          {selected.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
          {selected.map((tag) => (
            <SelectedPill key={tag.value} tag={tag} onRemove={removeTag} disabled={disabled} />
          ))}
        </div>
      </div>
    </Popover.Trigger>
  );
});

MultiSelectTrigger.displayName = "MultiSelectTrigger";
