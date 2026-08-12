import React, { useState } from "react";
import { computeWordDiff, computeLineDiff } from "@/lib/diffUtils";
import Layers from "lucide-react/dist/esm/icons/layers";
import Columns from "lucide-react/dist/esm/icons/columns";
import PlusCircle from "lucide-react/dist/esm/icons/plus-circle";
import MinusCircle from "lucide-react/dist/esm/icons/minus-circle";
import { Button } from "@/components/ui/button";

interface NoteDiffViewerProps {
  oldText: string;
  newText: string;
  oldVersionLabel?: string;
  newVersionLabel?: string;
}

export const NoteDiffViewer: React.FC<NoteDiffViewerProps> = ({
  oldText = "",
  newText = "",
  oldVersionLabel = "Version A",
  newVersionLabel = "Version B (Selected)",
}) => {
  const [viewMode, setViewMode] = useState<"inline" | "split">("inline");
  const [granularity, setGranularity] = useState<"word" | "line">("word");

  const diffResult =
    granularity === "word" ? computeWordDiff(oldText, newText) : computeLineDiff(oldText, newText);

  return (
    <div className="space-y-4">
      {/* ── Toolbar / Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-2 border-black bg-cream dark:bg-zinc-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-green-700 dark:text-green-400">
            <PlusCircle className="h-4 w-4" />
            <span>+{diffResult.stats.addedCount} additions</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-red-700 dark:text-red-400">
            <MinusCircle className="h-4 w-4" />
            <span>-{diffResult.stats.removedCount} deletions</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center border border-black bg-white dark:bg-zinc-900 p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("inline")}
              className={`h-7 px-2 font-mono text-[11px] uppercase ${
                viewMode === "inline" ? "bg-black text-white" : "text-black dark:text-white"
              }`}
            >
              <Layers className="h-3 w-3 mr-1" />
              Inline
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("split")}
              className={`h-7 px-2 font-mono text-[11px] uppercase ${
                viewMode === "split" ? "bg-black text-white" : "text-black dark:text-white"
              }`}
            >
              <Columns className="h-3 w-3 mr-1" />
              Side-by-Side
            </Button>
          </div>

          {/* Granularity Switcher */}
          <div className="flex items-center border border-black bg-white dark:bg-zinc-900 p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setGranularity("word")}
              className={`h-7 px-2 font-mono text-[11px] uppercase ${
                granularity === "word"
                  ? "bg-lime text-black font-bold"
                  : "text-black dark:text-white"
              }`}
            >
              Words
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setGranularity("line")}
              className={`h-7 px-2 font-mono text-[11px] uppercase ${
                granularity === "line"
                  ? "bg-lime text-black font-bold"
                  : "text-black dark:text-white"
              }`}
            >
              Lines
            </Button>
          </div>
        </div>
      </div>

      {/* ── Inline Diff View ── */}
      {viewMode === "inline" && (
        <div className="p-4 border-2 border-black bg-white dark:bg-zinc-900 font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-[450px] overflow-y-auto space-y-1">
          {diffResult.changes.map((change, idx) => {
            if (change.type === "added") {
              return (
                <mark
                  key={idx}
                  className="bg-green-200 dark:bg-green-950 text-green-950 dark:text-green-200 font-bold px-1 py-0.5 rounded border-l-2 border-green-600 inline-block my-0.5"
                >
                  +{change.value}
                </mark>
              );
            }
            if (change.type === "removed") {
              return (
                <del
                  key={idx}
                  className="bg-red-200 dark:bg-red-950 text-red-950 dark:text-red-200 line-through opacity-80 px-1 py-0.5 rounded border-l-2 border-red-600 inline-block my-0.5"
                >
                  -{change.value}
                </del>
              );
            }
            return <span key={idx}>{change.value}</span>;
          })}
        </div>
      )}

      {/* ── Side-by-Side Split View ── */}
      {viewMode === "split" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[450px] overflow-y-auto">
          {/* Version A (Original/Previous) */}
          <div className="border-2 border-black bg-white dark:bg-zinc-900">
            <div className="p-2 border-b-2 border-black bg-cream dark:bg-zinc-800 font-mono text-xs font-bold uppercase text-gray-700 dark:text-gray-300">
              {oldVersionLabel}
            </div>
            <div className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap space-y-1">
              {diffResult.changes.map((change, idx) => {
                if (change.type === "removed") {
                  return (
                    <del
                      key={idx}
                      className="bg-red-200 dark:bg-red-950 text-red-950 dark:text-red-200 line-through block p-1 rounded border-l-2 border-red-600"
                    >
                      {change.value}
                    </del>
                  );
                }
                if (change.type === "unchanged") {
                  return <span key={idx}>{change.value}</span>;
                }
                return null;
              })}
            </div>
          </div>

          {/* Version B (Selected/Current) */}
          <div className="border-2 border-black bg-white dark:bg-zinc-900">
            <div className="p-2 border-b-2 border-black bg-lime font-mono text-xs font-bold uppercase text-black">
              {newVersionLabel}
            </div>
            <div className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap space-y-1">
              {diffResult.changes.map((change, idx) => {
                if (change.type === "added") {
                  return (
                    <mark
                      key={idx}
                      className="bg-green-200 dark:bg-green-950 text-green-950 dark:text-green-200 font-bold block p-1 rounded border-l-2 border-green-600"
                    >
                      {change.value}
                    </mark>
                  );
                }
                if (change.type === "unchanged") {
                  return <span key={idx}>{change.value}</span>;
                }
                return null;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
