// src/components/Clubs/ConstitutionDiffModal.tsx
// -----------------------------------------------------------------------------
// Issue #3690 — Interactive "Club Constitution" Version Timeline
//
// Modal overlay that renders a visual word-level diff between two
// archived constitution versions, e.g. "Version 2 (2022)" vs
// "Version 5 (2026, current)".
//
// Uses the existing `diff` library (already in package.json as
// `diff@^9.0.0`) and reuses the rendering pattern from
// `src/components/Editor/DiffViewer.tsx`.
// -----------------------------------------------------------------------------

import { useMemo, useState } from "react";
import { diffWordsWithSpace, diffLines } from "diff";
import { X, GitCompare } from "lucide-react";
import type { ArchivedConstitution } from "@/lib/constitutionTimeline";
import { versionLabel } from "@/lib/constitutionTimeline";

export interface ConstitutionDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  oldVersion: ArchivedConstitution;
  newVersion: ArchivedConstitution;
}

type DiffMode = "word" | "line";

export function ConstitutionDiffModal({
  isOpen,
  onClose,
  oldVersion,
  newVersion,
}: ConstitutionDiffModalProps) {
  const [mode, setMode] = useState<DiffMode>("word");

  const parts = useMemo(() => {
    const oldText = oldVersion.raw_text ?? "";
    const newText = newVersion.raw_text ?? "";
    return mode === "word"
      ? diffWordsWithSpace(oldText, newText)
      : diffLines(oldText, newText);
  }, [oldVersion.raw_text, newVersion.raw_text, mode]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const p of parts) {
      if (p.added) added += p.value.length;
      if (p.removed) removed += p.value.length;
    }
    return { added, removed };
  }, [parts]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      data-testid="constitution-diff-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Constitution diff: ${versionLabel(oldVersion)} vs ${versionLabel(newVersion)}`}
    >
      <div className="flex w-full max-w-5xl flex-col bg-white border-4 border-black shadow-[8px_8px_0_0_#000] max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-black bg-blue-300 p-4">
          <div className="flex items-center gap-2">
            <GitCompare className="h-6 w-6" />
            <h2 className="font-display text-2xl font-black uppercase tracking-tight">
              Compare Versions
            </h2>
          </div>
          <button
            onClick={onClose}
            className="neu-border bg-red-400 p-1 hover:bg-red-500 transition-colors"
            aria-label="Close diff modal"
            data-testid="diff-modal-close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Version metadata strip */}
        <div className="flex items-stretch border-b-2 border-black">
          <div className="flex-1 p-3 bg-gray-50">
            <p className="font-mono text-[10px] uppercase text-gray-500">From</p>
            <p className="font-display text-sm font-bold uppercase">
              {versionLabel(oldVersion)}
            </p>
            {oldVersion.change_summary && (
              <p className="font-mono text-xs text-gray-600 mt-1 line-clamp-2">
                {oldVersion.change_summary}
              </p>
            )}
          </div>
          <div className="w-px bg-black" />
          <div className="flex-1 p-3 bg-green-50">
            <p className="font-mono text-[10px] uppercase text-gray-500">To</p>
            <p className="font-display text-sm font-bold uppercase">
              {versionLabel(newVersion)}
            </p>
            {newVersion.change_summary && (
              <p className="font-mono text-xs text-gray-600 mt-1 line-clamp-2">
                {newVersion.change_summary}
              </p>
            )}
          </div>
        </div>

        {/* Mode toggle + stats */}
        <div className="flex items-center justify-between p-3 bg-gray-100 border-b border-gray-200">
          <div className="flex items-center gap-1">
            <ModeButton
              active={mode === "word"}
              onClick={() => setMode("word")}
              label="Word diff"
            />
            <ModeButton
              active={mode === "line"}
              onClick={() => setMode("line")}
              label="Line diff"
            />
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-green-700">+{stats.added} chars added</span>
            <span className="text-red-700">−{stats.removed} chars removed</span>
          </div>
        </div>

        {/* Diff body */}
        <div
          className="flex-1 overflow-y-auto p-4 bg-white"
          data-testid="diff-modal-body"
        >
          <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {parts.map((part, idx) => {
              if (part.added) {
                return (
                  <span
                    key={idx}
                    className="bg-green-200 text-green-900 font-medium px-0.5 rounded-sm"
                  >
                    {part.value}
                  </span>
                );
              }
              if (part.removed) {
                return (
                  <span
                    key={idx}
                    className="bg-red-200 text-red-900 line-through font-medium px-0.5 rounded-sm opacity-80"
                  >
                    {part.value}
                  </span>
                );
              }
              return <span key={idx}>{part.value}</span>;
            })}
          </pre>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-black p-3 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="neu-border bg-white px-4 py-2 font-mono text-sm font-bold uppercase hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 font-mono text-xs uppercase border-2 border-black transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-white text-gray-700 hover:bg-gray-100"
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
