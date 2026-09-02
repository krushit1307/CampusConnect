import React, { useState } from "react";
import {
  AcousticWallConfig,
  AcousticSpeakerConfig,
  AcousticSimulationResults,
  ACOUSTIC_MATERIAL_PRESETS,
  WallType,
} from "../../types/acoustic";
import {
  Volume2,
  Settings,
  Plus,
  Trash2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  TrendingDown,
  Sparkles,
  ListRestart,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface AcousticSimulationPanelProps {
  speakers: AcousticSpeakerConfig[];
  walls: AcousticWallConfig[];
  results: AcousticSimulationResults;
  selectedSpeakerId: string | null;
  rayCount: number;
  onSelectSpeaker: (id: string | null) => void;
  onUpdateSpeaker: (speaker: AcousticSpeakerConfig) => void;
  onAddSpeaker: () => void;
  onRemoveSpeaker: (id: string) => void;
  onUpdateWall: (type: WallType, absorption: number, preset: string) => void;
  onUpdateRayCount: (count: number) => void;
}

export const AcousticSimulationPanel: React.FC<AcousticSimulationPanelProps> = ({
  speakers,
  walls,
  results,
  selectedSpeakerId,
  rayCount,
  onSelectSpeaker,
  onUpdateSpeaker,
  onAddSpeaker,
  onRemoveSpeaker,
  onUpdateWall,
  onUpdateRayCount,
}) => {
  const [activeTab, setActiveTab] = useState<"speakers" | "walls" | "presets">("speakers");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedSpeaker = speakers.find((s) => s.id === selectedSpeakerId) || null;

  const handleWallPresetChange = (type: WallType, presetKey: string) => {
    const preset = ACOUSTIC_MATERIAL_PRESETS[presetKey];
    if (preset) {
      onUpdateWall(type, preset.absorption, presetKey);
    }
  };

  const getSeverityColor = (severity: "none" | "moderate" | "severe") => {
    if (severity === "severe") return "bg-red-50 text-red-900 border-red-500";
    if (severity === "moderate") return "bg-amber-50 text-amber-900 border-amber-500";
    return "bg-emerald-50 text-emerald-900 border-emerald-500";
  };

  return (
    <div className="border-2 border-black rounded-xl p-5 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-mono space-y-6">
      {/* Simulation Result Header */}
      <div className="border-b-2 border-black pb-4 space-y-2">
        <h3 className="text-lg font-bold uppercase flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          Acoustic Simulation Results
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="border-2 border-black p-3 bg-indigo-50 rounded-md">
            <span className="text-[10px] text-gray-500 uppercase block font-bold">
              Sabine RT60 Decay
            </span>
            <span className="text-xl font-bold text-indigo-950">
              {results.rt60SabineSeconds.toFixed(2)}s
            </span>
          </div>
          <div className="border-2 border-black p-3 bg-purple-50 rounded-md">
            <span className="text-[10px] text-gray-500 uppercase block font-bold">
              Ray-Traced RT60
            </span>
            <span className="text-xl font-bold text-purple-950">
              {results.rt60RayTracedSeconds.toFixed(2)}s
            </span>
          </div>
        </div>
      </div>

      {/* Warnings & Suggestions block */}
      {results.warningSeverity !== "none" && (
        <div
          className={cn(
            "border-2 p-4 rounded-md flex gap-3 items-start",
            getSeverityColor(results.warningSeverity),
          )}
        >
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-xs uppercase">Acoustic Interference Warning</h4>
            <p className="text-xs font-sans font-medium">{results.warningMessage}</p>
          </div>
        </div>
      )}

      {/* Actionable Recommendations List */}
      {results.actionableGuidance.length > 0 && (
        <div className="border-2 border-black p-4 bg-amber-50 rounded-md space-y-2">
          <h4 className="text-xs font-bold uppercase text-amber-900 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4" />
            Actionable Optimization Advice:
          </h4>
          <ul className="list-disc pl-4 space-y-1.5 text-xs text-amber-950 font-sans font-medium">
            {results.actionableGuidance.map((advice, idx) => (
              <li key={idx}>{advice}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Controls Area Tabs */}
      <div className="flex border-b-2 border-black">
        <button
          onClick={() => setActiveTab("speakers")}
          className={cn(
            "flex-1 py-2 text-xs font-bold uppercase border-r-2 border-black last:border-r-0 transition-colors",
            activeTab === "speakers" ? "bg-black text-white" : "bg-gray-100 hover:bg-gray-200",
          )}
        >
          Speaker Controls ({speakers.length})
        </button>
        <button
          onClick={() => setActiveTab("walls")}
          className={cn(
            "flex-1 py-2 text-xs font-bold uppercase border-r-2 border-black last:border-r-0 transition-colors",
            activeTab === "walls" ? "bg-black text-white" : "bg-gray-100 hover:bg-gray-200",
          )}
        >
          Wall Dampings
        </button>
      </div>

      {/* Tab Contents: Speakers */}
      {activeTab === "speakers" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase text-gray-700">Acoustic Speakers:</label>
            <button
              onClick={onAddSpeaker}
              className="px-3 py-1 border-2 border-black bg-emerald-100 hover:bg-emerald-200 text-emerald-950 text-xs font-bold uppercase rounded-md flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Speaker
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {speakers.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelectSpeaker(selectedSpeakerId === s.id ? null : s.id)}
                className={cn(
                  "px-3 py-1.5 border-2 border-black rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors",
                  selectedSpeakerId === s.id
                    ? "bg-purple-100 border-purple-600 text-purple-950 shadow-[2px_2px_0px_0px_rgba(168,85,247,0.3)]"
                    : "bg-white hover:bg-gray-50",
                )}
              >
                <Volume2 className="w-3.5 h-3.5 text-purple-600" />
                {s.label}
              </button>
            ))}
          </div>

          {selectedSpeaker ? (
            <div className="border-2 border-black p-4 rounded-xl bg-gray-50 space-y-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-purple-950">
                  Editing: {selectedSpeaker.label}
                </span>
                <button
                  onClick={() => onRemoveSpeaker(selectedSpeaker.id)}
                  className="px-2 py-1 border border-black bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove
                </button>
              </div>

              {/* Slider for volume dB */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>Output Power (dB @ 1m):</span>
                  <span className="text-purple-600">{selectedSpeaker.dbOutput} dB</span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={125}
                  value={selectedSpeaker.dbOutput}
                  onChange={(e) =>
                    onUpdateSpeaker({ ...selectedSpeaker, dbOutput: Number(e.target.value) })
                  }
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>

              {/* Slider for dispersion angle */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>Cone Dispersion angle:</span>
                  <span className="text-purple-600">{selectedSpeaker.coneAngle}°</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={120}
                  value={selectedSpeaker.coneAngle}
                  onChange={(e) =>
                    onUpdateSpeaker({ ...selectedSpeaker, coneAngle: Number(e.target.value) })
                  }
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>

              {/* Slider for yaw rotation */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>Yaw Rotation (Direction):</span>
                  <span className="text-purple-600">{selectedSpeaker.yaw}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={selectedSpeaker.yaw}
                  onChange={(e) =>
                    onUpdateSpeaker({ ...selectedSpeaker, yaw: Number(e.target.value) })
                  }
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>

              {/* Slider for pitch tilt */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>Pitch Tilt (Vertical):</span>
                  <span className="text-purple-600">{selectedSpeaker.pitch}°</span>
                </div>
                <input
                  type="range"
                  min={-45}
                  max={45}
                  value={selectedSpeaker.pitch}
                  onChange={(e) =>
                    onUpdateSpeaker({ ...selectedSpeaker, pitch: Number(e.target.value) })
                  }
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <div className="py-8 border-2 border-dashed border-gray-300 rounded-lg text-center text-xs text-gray-500 font-sans">
              Select or add a speaker node to adjust volume, direction, and dispersion tilt.
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: Walls configs */}
      {activeTab === "walls" && (
        <div className="space-y-4">
          <p className="text-[11px] font-sans text-gray-600">
            Select surface damping materials to optimize reflection coefficients. Higher absorption
            absorbs acoustic energy and reduces echo.
          </p>

          <div className="space-y-3.5">
            {walls.map((wall) => (
              <div key={wall.type} className="flex flex-col gap-1 border-b pb-2 last:border-none">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase">{wall.name}:</span>
                  <span className="text-xs font-bold text-indigo-600">
                    α = {wall.absorptionCoefficient.toFixed(2)}
                  </span>
                </div>
                <select
                  value={wall.materialPreset}
                  onChange={(e) => handleWallPresetChange(wall.type, e.target.value)}
                  className="bg-white border-2 border-black p-1.5 font-mono text-xs focus:outline-none w-full"
                >
                  {Object.entries(ACOUSTIC_MATERIAL_PRESETS).map(([key, p]) => (
                    <option key={key} value={key}>
                      {p.name} (α = {p.absorption.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced configuration options (ray settings) */}
      <div className="border-t pt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs font-bold uppercase hover:text-indigo-600 transition-colors"
        >
          {showAdvanced ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          Advanced Simulation Settings
        </button>

        {showAdvanced && (
          <div className="mt-3 border-2 border-black p-4 rounded-lg bg-gray-50 space-y-3 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between font-bold">
                <span>Rays count per speaker:</span>
                <span>{rayCount} rays</span>
              </div>
              <input
                type="range"
                min={50}
                max={500}
                step={50}
                value={rayCount}
                onChange={(e) => onUpdateRayCount(Number(e.target.value))}
                className="w-full accent-black cursor-pointer"
              />
            </div>
            <div className="flex items-start gap-1.5 bg-indigo-50 border border-indigo-200 p-2.5 rounded text-[11px] font-sans text-indigo-950">
              <Info className="w-4 h-4 flex-shrink-0 text-indigo-700 mt-0.5" />
              <p>
                Rays are generated deterministically using Fibonacci golden-angle sphere sampling.
                Increasing ray counts improves decay curve simulation but requires more processor
                calculations.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
