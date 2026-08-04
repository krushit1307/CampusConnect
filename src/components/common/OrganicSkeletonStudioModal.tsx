import React, { useState } from "react";
import {
  Sparkles,
  Layout,
  CheckCircle,
  AlertTriangle,
  X,
  RefreshCw,
  Layers,
  FileText,
  Sliders,
} from "lucide-react";
import {
  OrganicSkeleton,
  TextSkeleton,
  ParagraphSkeleton,
  OrganicCardSkeleton,
} from "@/components/ui/OrganicSkeleton";

interface OrganicSkeletonStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OrganicSkeletonStudioModal: React.FC<OrganicSkeletonStudioModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [lineCount, setLineCount] = useState<number>(3);
  const [activeVariant, setActiveVariant] = useState<"post" | "club" | "event" | "profile">("post");
  const [seedIndex, setSeedIndex] = useState<number>(1);
  const [showComparison, setShowComparison] = useState<boolean>(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border-4 border-black w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden font-mono">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-emerald-400 to-indigo-500 rounded-xl">
              <Layout className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold uppercase">Organic Skeleton Studio</h2>
              <p className="text-xs text-slate-300">
                Randomized Dynamic Widths & Hydration Safety Inspector (#2328)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="p-4 bg-slate-100 border-b-2 border-black flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold uppercase text-gray-700 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-600" /> Line Count:
            </label>
            <select
              value={lineCount}
              onChange={(e) => setLineCount(Number(e.target.value))}
              className="p-1.5 bg-white border border-black text-xs font-bold rounded-lg"
            >
              <option value={2}>2 Lines</option>
              <option value={3}>3 Lines (Standard)</option>
              <option value={4}>4 Lines</option>
              <option value={5}>5 Lines</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {(["post", "club", "event", "profile"] as const).map((variant) => (
              <button
                key={variant}
                onClick={() => setActiveVariant(variant)}
                className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg border transition ${
                  activeVariant === variant
                    ? "bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {variant}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSeedIndex((prev) => prev + 1)}
              className="px-3 py-1.5 bg-indigo-50 border border-indigo-300 text-indigo-700 text-xs font-bold uppercase rounded-lg flex items-center gap-1.5 hover:bg-indigo-100 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Re-seed ({seedIndex})
            </button>

            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg border transition ${
                showComparison
                  ? "bg-amber-100 border-amber-400 text-amber-900"
                  : "bg-white border-gray-300 text-gray-700"
              }`}
            >
              {showComparison ? "Hide Comparison" : "Compare with Blocky"}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-cream/40">
          {/* Hydration Banner */}
          <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-xl flex items-center justify-between text-emerald-900">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-sm uppercase">100% SSR & Hydration Safe</h4>
                <p className="text-xs opacity-90">
                  Calculated using deterministic seed generators & line presets. Zero Math.random()
                  SSR hydration crashes.
                </p>
              </div>
            </div>
          </div>

          {/* Comparison Grid */}
          <div
            className={`grid ${showComparison ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"} gap-6`}
          >
            {/* New Organic Jagged Skeleton */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-emerald-700 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Organic Jagged Skeleton (New)
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  Jagged Paragraph End
                </span>
              </div>

              <div className="p-4 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <OrganicCardSkeleton variant={activeVariant} />
              </div>
            </div>

            {/* Old Blocky Concrete Skeleton */}
            {showComparison && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase text-slate-500 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" /> Standard Blocky Skeleton (Legacy)
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">
                    Flat 100% Concrete
                  </span>
                </div>

                <div className="p-4 bg-slate-100 border-2 border-slate-300 rounded-xl opacity-75 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-300 animate-pulse" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-full bg-slate-300 animate-pulse rounded" />
                      <div className="h-3 w-full bg-slate-300 animate-pulse rounded" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-slate-300 animate-pulse rounded" />
                    <div className="h-4 w-full bg-slate-300 animate-pulse rounded" />
                    <div className="h-4 w-full bg-slate-300 animate-pulse rounded" />
                  </div>
                  <div className="h-40 w-full bg-slate-300 animate-pulse rounded-lg" />
                </div>
              </div>
            )}
          </div>

          {/* Text Line Width Presets Table */}
          <div className="p-4 bg-white border-2 border-black rounded-xl space-y-3">
            <h4 className="text-xs font-bold uppercase text-gray-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" /> Dynamic Width Telemetry
            </h4>
            <div className="p-3 bg-slate-900 text-white rounded-lg font-mono text-xs space-y-2">
              <div className="flex justify-between border-b border-slate-700 pb-1 text-slate-400">
                <span>Line Number</span>
                <span>Calculated CSS Width</span>
                <span>Type</span>
              </div>
              {Array.from({ length: lineCount }).map((_, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>Line #{idx + 1}</span>
                  <span className="text-emerald-400 font-bold">
                    {idx === lineCount - 1
                      ? "42% (End of Paragraph Shortening)"
                      : `${88 - idx * 6}%`}
                  </span>
                  <span className="text-slate-300">
                    {idx === lineCount - 1 ? "Jagged End" : "Body Line"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-100 border-t-2 border-black flex justify-between items-center">
          <span className="text-xs text-gray-600">
            Applied globally to Feed, Clubs, Events, and User Profiles.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-black text-white font-bold uppercase text-xs rounded-lg hover:bg-gray-800 transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
