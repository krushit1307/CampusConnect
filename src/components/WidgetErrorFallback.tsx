import React, { useState } from "react";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import Bug from "lucide-react/dist/esm/icons/bug";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WidgetErrorFallbackProps {
  title?: string;
  error?: Error | null;
  resetErrorBoundary?: () => void;
  retryCount?: number;
  maxRetries?: number;
  className?: string;
}

/**
 * Localized Error Fallback UI for individual widgets (#1737).
 * Displays a bordered box with warning icon, title, localized error message,
 * retry button with cooldown/max-retry protection, and bug report option.
 */
export const WidgetErrorFallback: React.FC<WidgetErrorFallbackProps> = ({
  title = "Widget Unavailable",
  error,
  resetErrorBoundary,
  retryCount = 0,
  maxRetries = 3,
  className,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const isMaxRetriesReached = retryCount >= maxRetries;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "neu-border bg-amber-50/90 dark:bg-amber-950/20 p-4 border-2 border-black rounded-xl shadow-sm space-y-3 font-mono text-black dark:text-amber-200",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg neu-border border-black text-amber-800 dark:text-amber-300 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              This feature encountered an issue. The rest of the page remains functional.
            </p>
          </div>
        </div>
      </div>

      {error?.message && (
        <div className="text-xs font-semibold bg-white/60 dark:bg-black/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <span className="truncate pr-2 font-mono text-[11px] text-amber-900 dark:text-amber-200">
              Error: {error.message}
            </span>
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
            >
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showDetails ? "Hide" : "Details"}
            </button>
          </div>
          {showDetails && error.stack && (
            <pre className="mt-2 max-h-32 overflow-x-auto p-2 bg-black/90 text-lime text-[10px] rounded font-mono whitespace-pre-wrap">
              {error.stack}
            </pre>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {resetErrorBoundary && !isMaxRetriesReached && (
          <Button
            size="sm"
            onClick={resetErrorBoundary}
            className="neu-border bg-black text-white hover:bg-gray-800 font-mono text-xs font-bold uppercase h-8 px-3 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry {retryCount > 0 ? `(${retryCount}/${maxRetries})` : ""}
          </Button>
        )}

        {isMaxRetriesReached && (
          <span className="text-[11px] font-bold text-destructive">
            Max retries reached ({retryCount}/{maxRetries}).
          </span>
        )}

        <a
          href="https://github.com/krushit1307/CampusConnect/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs font-bold underline flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Bug className="w-3.5 h-3.5" /> Report Issue
        </a>
      </div>
    </div>
  );
};
