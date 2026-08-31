// ============================================================
// CampusConnect – Content Warning Banner Component
// src/components/ContentWarningBanner.tsx
// Issue #3679: Automated Content Warning Tagging
// ============================================================

import { useState } from "react";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatWarningCategories,
  getWarningDescription,
  type WarningCategory,
} from "@/services/contentWarningService";

interface ContentWarningBannerProps {
  warningTags: string[];
  children: React.ReactNode;
  className?: string;
}

export function ContentWarningBanner({
  warningTags,
  children,
  className,
}: ContentWarningBannerProps) {
  const [revealed, setRevealed] = useState(false);

  if (!warningTags || warningTags.length === 0) {
    return <>{children}</>;
  }

  const categories = warningTags as WarningCategory[];
  const categoryText = formatWarningCategories(categories);
  const description = getWarningDescription(categories);

  return (
    <div className={cn("relative", className)}>
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">
            ⚠️ Content Warning: {categoryText}
          </p>
          <p className="mt-1 text-xs text-amber-700">{description}</p>
          {!revealed && (
            <button
              onClick={() => setRevealed(true)}
              className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700"
            >
              <Eye className="h-3.5 w-3.5" />
              I understand, reveal description
            </button>
          )}
          {revealed && (
            <button
              onClick={() => setRevealed(false)}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700 underline transition hover:text-amber-900"
            >
              <EyeOff className="h-3.5 w-3.5" />
              Hide description
            </button>
          )}
        </div>
      </div>

      {/* Blurred content */}
      <div
        className={cn(
          "mt-3 transition-all duration-300",
          !revealed && "pointer-events-none select-none blur-sm",
        )}
        aria-hidden={!revealed}
      >
        {children}
      </div>
    </div>
  );
}
