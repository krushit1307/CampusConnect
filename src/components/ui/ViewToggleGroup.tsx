"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { motion } from "framer-motion";
import LayoutGrid from "lucide-react/dist/esm/icons/layout-grid";
import List from "lucide-react/dist/esm/icons/list";
import { cn } from "@/lib/utils";

export type FeedViewMode = "grid" | "list";

interface ViewToggleGroupProps {
  value: FeedViewMode;
  onValueChange: (value: FeedViewMode) => void;
}

const OPTIONS: { value: FeedViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { value: "grid", label: "Grid View", icon: LayoutGrid },
  { value: "list", label: "List View", icon: List },
];

export function ViewToggleGroup({ value, onValueChange }: ViewToggleGroupProps) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        // Radix fires "" when the active item is clicked again — ignore it
        // so the toggle can never end up with nothing selected.
        if (next) onValueChange(next as FeedViewMode);
      }}
      aria-label="Feed layout"
      className="inline-flex items-center gap-1 rounded-full bg-gray-200 p-1 dark:bg-white/10"
    >
      {OPTIONS.map(({ value: optionValue, label, icon: Icon }) => (
        <ToggleGroupPrimitive.Item
          key={optionValue}
          value={optionValue}
          aria-label={label}
          className="relative z-0 flex items-center justify-center rounded-full px-3 py-1.5 text-sm font-medium text-gray-600 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-black dark:text-cream"
        >
          {value === optionValue && (
            <motion.span
              layoutId="view-toggle-active-pill"
              className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm"
              transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            />
          )}
          <Icon className="h-4 w-4" />
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
