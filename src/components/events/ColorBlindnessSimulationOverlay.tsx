// =============================================================================
// File: src/components/events/ColorBlindnessSimulationOverlay.tsx
// Task: Real-Time "Accessibility Need" Color Blindness Simulation Overlay
// Description: Diagnostic Color Blindness Simulator built directly into the Event Page
//              Editor. Features real-time GPU-accelerated SVG feColorMatrix transforms,
//              CVD mode selector, split-view preview mode, and WCAG contrast check reports.
// =============================================================================

import React, { useState } from "react";
import Eye from "lucide-react/dist/esm/icons/eye";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Sliders from "lucide-react/dist/esm/icons/sliders";
import Split from "lucide-react/dist/esm/icons/split";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import {
  CVD_PROFILES,
  evaluateEventPageAccessibility,
  type CvdMode,
} from "@/utils/colorBlindnessSimulator";

export interface ColorBlindnessSimulationOverlayProps {
  children?: React.ReactNode;
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  initialMode?: CvdMode;
  showDiagnosticPanel?: boolean;
}

export const ColorBlindnessSimulationOverlay: React.FC<ColorBlindnessSimulationOverlayProps> = ({
  children,
  primaryColor = "#10B981",
  backgroundColor = "#FFFFFF",
  textColor = "#000000",
  initialMode = "normal",
  showDiagnosticPanel = true,
}) => {
  const [activeMode, setActiveMode] = useState<CvdMode>(initialMode);
  const [isSplitView, setIsSplitView] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const profile = CVD_PROFILES[activeMode];
  const diagnosticChecks = evaluateEventPageAccessibility(
    primaryColor,
    backgroundColor,
    textColor,
    activeMode
  );

  const hasFailures = diagnosticChecks.some((c) => c.severity === "error");

  return (
    <div
      className="relative w-full space-y-4 font-sans"
      data-testid="color-blindness-simulator-overlay"
    >
      {/* 1. Global SVG Filter Definitions Injection */}
      <svg className="absolute h-0 w-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <defs>
          {Object.values(CVD_PROFILES).map((p) => (
            <filter id={p.filterId} key={p.filterId} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={p.svgMatrix.trim()} />
            </filter>
          ))}
        </defs>
      </svg>

      {/* 2. Neubrutalist Diagnostic Control Toolbar */}
      <div className="neu-border border-4 border-black bg-purple-50 p-4 shadow-[6px_6px_0_0_#000] dark:bg-zinc-900 dark:border-purple-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/20 pb-3">
          <div className="flex items-center gap-2">
            <div className="border-2 border-black bg-purple-400 p-2 shadow-[2px_2px_0_0_#000]">
              <Eye className="h-5 w-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-black uppercase text-base text-black dark:text-white">
                  Color Blindness Simulator
                </h3>
                <span
                  className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 border border-black bg-purple-200 text-purple-950 shadow-[1px_1px_0_0_#000]"
                  data-testid="simulator-active-badge"
                >
                  {profile.name.split(" ")[0]}
                </span>
              </div>
              <p className="font-mono text-xs text-gray-700 dark:text-gray-300">
                Real-time accessibility preview for Event Page Editor
              </p>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSplitView(!isSplitView)}
              className={`border-2 border-black font-mono text-xs font-bold uppercase px-3 py-1.5 shadow-[2px_2px_0_0_#000] flex items-center gap-1.5 transition-all ${
                isSplitView ? "bg-amber-300 text-black" : "bg-white text-black hover:bg-gray-100"
              }`}
              data-testid="toggle-split-view-btn"
            >
              <Split className="h-4 w-4" />
              {isSplitView ? "Split View On" : "Split View"}
            </button>

            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="border-2 border-black bg-white hover:bg-gray-100 px-3 py-1.5 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000]"
            >
              {isCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="pt-3 space-y-3">
            {/* CVD Mode Selectors */}
            <div className="space-y-1.5">
              <label className="font-mono text-xs font-black uppercase text-black dark:text-white flex items-center gap-1">
                <Sliders className="h-3.5 w-3.5 text-purple-700" />
                Select Color Vision Deficiency (CVD) Simulation Mode:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(CVD_PROFILES) as CvdMode[]).map((modeKey) => {
                  const prof = CVD_PROFILES[modeKey];
                  const isSelected = activeMode === modeKey;
                  return (
                    <button
                      key={modeKey}
                      type="button"
                      onClick={() => setActiveMode(modeKey)}
                      className={`border-2 border-black p-2 text-left font-mono text-xs shadow-[2px_2px_0_0_#000] transition-all cursor-pointer ${
                        isSelected
                          ? "bg-purple-600 text-white font-bold translate-y-[1px]"
                          : "bg-white hover:bg-purple-100 text-black dark:bg-zinc-800 dark:text-white"
                      }`}
                      data-testid={`cvd-mode-btn-${modeKey}`}
                    >
                      <span className="block font-bold text-[11px] truncate">{prof.name}</span>
                      <span className="text-[9px] opacity-80 block truncate font-normal">
                        {prof.populationPercentage}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Profile Detail Banner */}
            <div className="border-2 border-black bg-white p-2.5 font-mono text-xs space-y-1 shadow-[2px_2px_0_0_#000] dark:bg-zinc-800">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-900 dark:text-purple-300 uppercase">
                  Profile: {profile.name}
                </span>
                <span className="text-[10px] bg-purple-100 text-purple-900 border border-black px-1.5 py-0.5 font-bold">
                  {profile.affectedCones}
                </span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-[11px]">{profile.description}</p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Event Preview Canvas Container with Real-Time SVG CVD Filter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono text-xs font-bold uppercase text-black dark:text-white">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-purple-600" />
            Live Event Page Canvas Preview
          </span>
          <span className="text-[10px] text-gray-500">
            {activeMode === "normal"
              ? "Standard RGB View"
              : `Simulated Filter: ${profile.name}`}
          </span>
        </div>

        {isSplitView ? (
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            data-testid="simulator-split-view-container"
          >
            {/* Left: Normal Vision */}
            <div className="space-y-1">
              <span className="border-2 border-black bg-emerald-300 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-black inline-block shadow-[1px_1px_0_0_#000]">
                Normal Vision (100% Color RGB)
              </span>
              <div className="border-4 border-black p-4 bg-white shadow-[4px_4px_0_0_#000] overflow-hidden">
                {children}
              </div>
            </div>

            {/* Right: Simulated CVD Vision */}
            <div className="space-y-1">
              <span className="border-2 border-black bg-purple-300 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-black inline-block shadow-[1px_1px_0_0_#000]">
                Simulated ({profile.name.split(" ")[0]})
              </span>
              <div
                className="border-4 border-black p-4 bg-white shadow-[4px_4px_0_0_#000] overflow-hidden"
                style={{
                  filter:
                    activeMode !== "normal" ? `url(#${profile.filterId})` : "none",
                }}
                data-testid="simulated-canvas-wrapper"
              >
                {children}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="border-4 border-black p-4 bg-white shadow-[6px_6px_0_0_#000] overflow-hidden transition-all dark:bg-zinc-900"
            style={{
              filter: activeMode !== "normal" ? `url(#${profile.filterId})` : "none",
            }}
            data-testid="simulated-canvas-wrapper"
          >
            {children}
          </div>
        )}
      </div>

      {/* 4. Diagnostic WCAG Accessibility Report Panel */}
      {showDiagnosticPanel && (
        <div
          className={`neu-border border-4 border-black p-4 shadow-[4px_4px_0_0_#000] space-y-3 ${
            hasFailures ? "bg-rose-50 dark:bg-rose-950" : "bg-emerald-50 dark:bg-emerald-950"
          }`}
          data-testid="diagnostic-accessibility-report"
        >
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <h4 className="font-display font-black uppercase text-sm flex items-center gap-2 text-black dark:text-white">
              {hasFailures ? (
                <ShieldAlert className="h-5 w-5 text-rose-600" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              )}
              Diagnostic Accessibility Audit Report ({profile.name.split(" ")[0]})
            </h4>
            <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 border border-black bg-white text-black shadow-[1px_1px_0_0_#000]">
              WCAG 2.1 AAA/AA Check
            </span>
          </div>

          <div className="space-y-2">
            {diagnosticChecks.map((check) => (
              <div
                key={check.id}
                className="border-2 border-black bg-white p-3 space-y-1 shadow-[2px_2px_0_0_#000] dark:bg-zinc-800"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-black dark:text-white flex items-center gap-1">
                    {check.severity === "error" && <AlertTriangle className="h-4 w-4 text-rose-600" />}
                    {check.severity === "warning" && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    {check.severity === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    {check.title}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 border border-black uppercase ${
                      check.wcagLevel === "WCAG AAA"
                        ? "bg-emerald-300 text-emerald-950"
                        : check.wcagLevel === "WCAG AA"
                        ? "bg-amber-200 text-amber-950"
                        : "bg-rose-300 text-rose-950"
                    }`}
                  >
                    {check.wcagLevel}
                  </span>
                </div>

                <p className="font-mono text-xs text-gray-700 dark:text-gray-300">
                  {check.message}
                </p>

                {check.recommendation && (
                  <div className="font-mono text-[11px] text-purple-900 bg-purple-50 p-1.5 border border-purple-300 mt-1 dark:bg-purple-950 dark:text-purple-200">
                    💡 <strong>Recommendation:</strong> {check.recommendation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
