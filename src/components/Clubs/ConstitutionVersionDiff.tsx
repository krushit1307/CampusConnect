import { useMemo, useState } from "react";
import { diffLines, type Change } from "diff";
import { ArrowLeft, ArrowRight, Plus, Minus, Equal, Copy, Check } from "lucide-react";

interface ConstitutionVersionDiffProps {
  oldText: string;
  newText: string;
  oldVersion: number;
  newVersion: number;
  onClose?: () => void;
}

type ViewMode = "split" | "unified";

/**
 * Interactive line-by-line diff viewer for club constitutions.
 * Uses the `diff` library to compute structural changes between two
 * version strings, then renders additions in green and deletions in red
 * so members can instantly spot what changed between revisions.
 */
export function ConstitutionVersionDiff({
  oldText,
  newText,
  oldVersion,
  newVersion,
  onClose,
}: ConstitutionVersionDiffProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [copied, setCopied] = useState(false);

  const changes = useMemo(() => diffLines(oldText, newText), [oldText, newText]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    let unchanged = 0;
    for (const part of changes) {
      const lines = part.count ?? 0;
      if (part.added) added += lines;
      else if (part.removed) removed += lines;
      else unchanged += lines;
    }
    return { added, removed, unchanged, total: added + removed + unchanged };
  }, [changes]);

  const handleCopyAll = () => {
    const text = changes
      .map((c) => {
        const prefix = c.added ? "+ " : c.removed ? "- " : "  ";
        return (c.value.trimEnd() + "\n")
          .split("\n")
          .filter(Boolean)
          .map((l) => prefix + l)
          .join("\n");
      })
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderLine = (
    line: string,
    type: "added" | "removed" | "unchanged",
    lineNum: number | null,
  ) => {
    const bg =
      type === "added"
        ? "bg-green-50 dark:bg-green-950/30 border-l-4 border-green-500"
        : type === "removed"
          ? "bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500"
          : "border-l-4 border-transparent";
    const textClass =
      type === "added"
        ? "text-green-800 dark:text-green-300"
        : type === "removed"
          ? "text-red-800 dark:text-red-300"
          : "text-gray-700 dark:text-gray-300";

    return (
      <div
        key={`${type}-${lineNum}-${line.slice(0, 20)}`}
        className={`flex font-mono text-xs leading-6 ${bg}`}
      >
        {lineNum !== null && (
          <span className="w-12 shrink-0 select-none text-right pr-2 text-gray-400 dark:text-gray-600 border-r border-gray-200 dark:border-gray-700">
            {lineNum}
          </span>
        )}
        <span className="w-6 shrink-0 text-center font-bold">
          {type === "added" ? (
            <Plus size={10} className="inline text-green-600" />
          ) : type === "removed" ? (
            <Minus size={10} className="inline text-red-600" />
          ) : (
            <Equal size={10} className="inline text-gray-300" />
          )}
        </span>
        <span className={`flex-1 whitespace-pre-wrap px-2 ${textClass}`}>{line || "\u00A0"}</span>
      </div>
    );
  };

  const renderSplitView = () => {
    const leftLines: {
      line: string;
      num: number;
      type: "removed" | "unchanged";
    }[] = [];
    const rightLines: {
      line: string;
      num: number;
      type: "added" | "unchanged";
    }[] = [];
    let oldLine = 1;
    let newLine = 1;

    for (const part of changes) {
      const lines = part.value
        .split("\n")
        .filter((_, i, arr) => i < arr.length - 1 || arr[arr.length - 1] !== "");
      for (const line of lines) {
        if (part.removed) {
          leftLines.push({ line, num: oldLine++, type: "removed" });
        } else if (part.added) {
          rightLines.push({ line, num: newLine++, type: "added" });
        } else {
          leftLines.push({ line, num: oldLine++, type: "unchanged" });
          rightLines.push({ line, num: newLine++, type: "unchanged" });
        }
      }
    }

    const maxLen = Math.max(leftLines.length, rightLines.length);
    while (leftLines.length < maxLen) leftLines.push({ line: "", num: -1, type: "unchanged" });
    while (rightLines.length < maxLen) rightLines.push({ line: "", num: -1, type: "unchanged" });

    return (
      <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
        <div className="overflow-x-auto">
          {leftLines.map((l, i) => (
            <div
              key={`l-${i}`}
              className={l.type === "removed" ? "bg-red-50 dark:bg-red-950/30" : ""}
            >
              {renderLine(l.line, l.type, l.num > 0 ? l.num : null)}
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          {rightLines.map((l, i) => (
            <div
              key={`r-${i}`}
              className={l.type === "added" ? "bg-green-50 dark:bg-green-950/30" : ""}
            >
              {renderLine(l.line, l.type, l.num > 0 ? l.num : null)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderUnifiedView = () => {
    let lineNum = 1;
    return (
      <div className="overflow-x-auto">
        {changes.map((part, partIdx) => {
          const lines = part.value
            .split("\n")
            .filter((_, i, arr) => i < arr.length - 1 || arr[arr.length - 1] !== "");
          return lines.map((line, lineIdx) => {
            const type = part.added
              ? ("added" as const)
              : part.removed
                ? ("removed" as const)
                : ("unchanged" as const);
            const num = type !== "added" ? lineNum++ : null;
            return <div key={`${partIdx}-${lineIdx}`}>{renderLine(line, type, num)}</div>;
          });
        })}
      </div>
    );
  };

  return (
    <div className="neu-border bg-white dark:bg-zinc-900 shadow-[6px_6px_0_0_#000] flex flex-col max-h-[80vh]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-black p-4 bg-cream dark:bg-zinc-800">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="neu-border neu-press bg-white dark:bg-zinc-700 p-2"
              title="Back to history"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <h3 className="font-display text-lg font-black uppercase">Constitution Diff</h3>
          <div className="flex items-center gap-1 font-mono text-xs font-bold">
            <span className="bg-red-200 dark:bg-red-900 px-2 py-0.5 border border-black">
              v{oldVersion}
            </span>
            <ArrowRight size={12} />
            <span className="bg-green-200 dark:bg-green-900 px-2 py-0.5 border border-black">
              v{newVersion}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Stats */}
          <div className="flex items-center gap-3 font-mono text-xs font-bold mr-2">
            <span className="text-green-600">+{stats.added}</span>
            <span className="text-red-600">-{stats.removed}</span>
            <span className="text-gray-500">~{stats.unchanged} same</span>
          </div>

          {/* View toggle */}
          <div className="neu-border flex overflow-hidden bg-white dark:bg-zinc-700 text-xs font-bold font-mono">
            <button
              onClick={() => setViewMode("split")}
              className={`px-3 py-1.5 ${
                viewMode === "split"
                  ? "bg-black text-white"
                  : "hover:bg-gray-100 dark:hover:bg-zinc-600"
              }`}
            >
              Split
            </button>
            <button
              onClick={() => setViewMode("unified")}
              className={`px-3 py-1.5 ${
                viewMode === "unified"
                  ? "bg-black text-white"
                  : "hover:bg-gray-100 dark:hover:bg-zinc-600"
              }`}
            >
              Unified
            </button>
          </div>

          {/* Copy */}
          <button
            onClick={handleCopyAll}
            className="neu-border neu-press bg-white dark:bg-zinc-700 p-2"
            title="Copy diff"
          >
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-y-auto">
        {stats.added === 0 && stats.removed === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Equal size={32} className="text-gray-400 mb-3" />
            <p className="font-mono text-sm font-bold text-gray-500">No differences found</p>
            <p className="font-mono text-xs text-gray-400 mt-1">
              These two versions are identical.
            </p>
          </div>
        ) : viewMode === "split" ? (
          renderSplitView()
        ) : (
          renderUnifiedView()
        )}
      </div>

      {/* Footer */}
      <div className="border-t-2 border-black p-3 bg-gray-50 dark:bg-zinc-800 font-mono text-[10px] text-gray-500 text-center">
        {stats.total} total lines · {stats.added} added · {stats.removed} removed ·{" "}
        {stats.unchanged} unchanged
      </div>
    </div>
  );
}
