// src/components/AffiliationBadgesToggle.tsx
import React from "react";
import Shield from "lucide-react/dist/esm/icons/shield";

interface AffiliationBadgesToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function AffiliationBadgesToggle({
  checked,
  onChange,
  className = "",
}: AffiliationBadgesToggleProps) {
  return (
    <label
      className={`inline-flex items-center gap-2 cursor-pointer font-mono text-xs text-black dark:text-cream select-none ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded-none accent-black border-2 border-black cursor-pointer"
      />
      <span className="flex items-center gap-1">
        <Shield size={13} className="text-amber-500" />
        Display my club executive badges on this post
      </span>
    </label>
  );
}
