import React, { useState, useMemo } from "react";
import {
  Box,
  Eye,
  Move,
  RotateCw,
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Activity,
} from "lucide-react";
import {
  SpatialItem,
  isValid3DModelUrl,
  calculateTableCapacityFit,
  generateTableGridPrimitives,
} from "@/lib/venue3DViewer";
import { cn } from "@/lib/utils";
import { AcousticVisualizerCanvas } from "./AcousticVisualizerCanvas";
import { AcousticSimulationPanel } from "./AcousticSimulationPanel";
import { AcousticRayTracer } from "@/lib/acousticRayTracer";
import { AcousticWallConfig, AcousticSpeakerConfig, WallType } from "@/types/acoustic";

export interface Venue3DModelViewerProps {
  modelUrl?: string | null;
  venueName?: string;
  widthMeters?: number;
  depthMeters?: number;
  heightMeters?: number;
  initialItems?: SpatialItem[];
  onLayoutChange?: (items: SpatialItem[]) => void;
  className?: string;
}

export const Venue3DModelViewer: React.FC<Venue3DModelViewerProps> = ({
  modelUrl,
  venueName = "Main Ballroom",
  widthMeters = 30,
  depthMeters = 20,
  heightMeters = 6,
  initialItems = [],
  onLayoutChange,
  className,
}) => {
  const [tableCount, setTableCount] = useState<number>(initialItems.length || 20);
  const [items, setItems] = useState<SpatialItem[]>(() => {
    return initialItems.length > 0
      ? initialItems
      : generateTableGridPrimitives(20, widthMeters, depthMeters);
  });
  const [activeTab, setActiveTab] = useState<"3d" | "2d" | "acoustic">("3d");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Acoustic Simulation States
  const [rayCount, setRayCount] = useState<number>(200);
  const [walls, setWalls] = useState<AcousticWallConfig[]>(() => [
    { type: "left", name: "Left Wall", absorptionCoefficient: 0.1, materialPreset: "plaster" },
    { type: "right", name: "Right Wall", absorptionCoefficient: 0.1, materialPreset: "plaster" },
    { type: "floor", name: "Floor", absorptionCoefficient: 0.2, materialPreset: "carpet_thin" },
    { type: "ceiling", name: "Ceiling", absorptionCoefficient: 0.05, materialPreset: "concrete" },
    { type: "front", name: "Front Wall", absorptionCoefficient: 0.1, materialPreset: "plaster" },
    { type: "back", name: "Back Wall", absorptionCoefficient: 0.1, materialPreset: "plaster" },
  ]);

  const capacityFit = calculateTableCapacityFit(widthMeters, depthMeters);
  const hasValidModel = isValid3DModelUrl(modelUrl);

  const handleTableCountChange = (count: number) => {
    const newCount = Math.max(1, Math.min(count, capacityFit.maxTables));
    setTableCount(newCount);
    const newItems = generateTableGridPrimitives(newCount, widthMeters, depthMeters);
    setItems(newItems);
    if (onLayoutChange) onLayoutChange(newItems);
  };

  const handleAddItem = (type: SpatialItem["type"]) => {
    const isSpk = type === "speaker";
    const isStage = type === "stage";

    const newItem: SpatialItem = {
      id: `item-${Date.now()}`,
      type,
      label: isStage
        ? "Main Stage"
        : isSpk
          ? `Speaker #${items.filter((i) => i.type === "speaker").length + 1}`
          : `${type === "round_table" ? "Table" : "Item"} #${items.length + 1}`,
      x: 0,
      y: isStage ? 0.4 : isSpk ? 1.8 : 0.75, // speakers default height is 1.8m
      z: 0,
      rotationY: 0,
      width: isStage ? 6 : isSpk ? 0.6 : 1.8,
      depth: isStage ? 4 : isSpk ? 0.4 : 1.8,
      speakerDb: isSpk ? 100 : undefined,
      speakerConeAngle: isSpk ? 90 : undefined,
      speakerPitch: isSpk ? 0 : undefined,
      speakerYaw: isSpk ? 0 : undefined,
    };
    const updated = [...items, newItem];
    setItems(updated);
    setSelectedItemId(newItem.id);
    if (onLayoutChange) onLayoutChange(updated);
  };

  const removeItem = (id: string) => {
    const updated = items.filter((i) => i.id !== id);
    setItems(updated);
    if (selectedItemId === id) setSelectedItemId(null);
    if (onLayoutChange) onLayoutChange(updated);
  };

  const handleUpdateWall = (type: WallType, absorption: number, preset: string) => {
    setWalls((prev) =>
      prev.map((w) =>
        w.type === type ? { ...w, absorptionCoefficient: absorption, materialPreset: preset } : w,
      ),
    );
  };

  // Convert layout items of type "speaker" to active configurations for simulator
  const speakers = useMemo<AcousticSpeakerConfig[]>(() => {
    return items
      .filter((i) => i.type === "speaker")
      .map((i) => ({
        id: i.id,
        label: i.label,
        x: i.x,
        y: i.y,
        z: i.z,
        yaw: i.speakerYaw ?? i.rotationY ?? 0,
        pitch: i.speakerPitch ?? 0,
        coneAngle: i.speakerConeAngle ?? 90,
        dbOutput: i.speakerDb ?? 100,
      }));
  }, [items]);

  // Hook speaker updates back to main layout items list
  const handleUpdateSpeaker = (updatedSpeaker: AcousticSpeakerConfig) => {
    const updatedItems = items.map((item) => {
      if (item.id === updatedSpeaker.id) {
        return {
          ...item,
          x: updatedSpeaker.x,
          y: updatedSpeaker.y,
          z: updatedSpeaker.z,
          rotationY: updatedSpeaker.yaw,
          speakerYaw: updatedSpeaker.yaw,
          speakerPitch: updatedSpeaker.pitch,
          speakerConeAngle: updatedSpeaker.coneAngle,
          speakerDb: updatedSpeaker.dbOutput,
        };
      }
      return item;
    });
    setItems(updatedItems);
    if (onLayoutChange) onLayoutChange(updatedItems);
  };

  // Ray-Tracing Simulation calculations
  const tracer = useMemo(() => {
    return new AcousticRayTracer(widthMeters, depthMeters, heightMeters, walls);
  }, [widthMeters, depthMeters, heightMeters, walls]);

  const simResults = useMemo(() => {
    return tracer.runSimulation(speakers, rayCount, 4, 20, 50);
  }, [tracer, speakers, rayCount]);

  const fitsInVenue = items.length <= capacityFit.maxTables;

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-mono",
        className,
      )}
    >
      {/* Top Header & Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-peach/30 border-b-2 border-black">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-black">
            <Box className="w-5 h-5 text-purple-600" />
            <span>3D Spatial Venue Planner — {venueName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-0.5">
            Dimensions: {widthMeters}m x {depthMeters}m x {heightMeters}m | Max Circular Capacity:{" "}
            {capacityFit.maxTables} tables ({capacityFit.maxGuests} guests)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex border-2 border-black rounded-md overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setActiveTab("3d")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold uppercase flex items-center gap-1.5 transition-colors",
                activeTab === "3d" ? "bg-black text-white" : "hover:bg-gray-100",
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              WebGL 3D View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("2d")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold uppercase flex items-center gap-1.5 transition-colors",
                activeTab === "2d" ? "bg-black text-white" : "hover:bg-gray-100",
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              2D Spatial Floorplan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("acoustic")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold uppercase flex items-center gap-1.5 transition-colors",
                activeTab === "acoustic" ? "bg-black text-white" : "hover:bg-gray-100",
              )}
            >
              <Activity className="w-3.5 h-3.5 text-indigo-500" />
              Acoustic Simulation
            </button>
          </div>
        </div>
      </div>

      {/* 3D WebGL Canvas Area & Ray Tracing Simulator View */}
      <div
        className={cn(
          "relative bg-slate-950 text-white overflow-hidden flex select-none",
          activeTab === "acoustic"
            ? "min-h-[520px] p-6 bg-slate-900 overflow-y-auto block"
            : "h-[480px] items-center justify-center",
        )}
      >
        {activeTab !== "acoustic" && (
          <>
            {/* Model status banner */}
            <div className="absolute top-3 left-3 z-10 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-xs font-bold flex items-center gap-2">
              {hasValidModel ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Loaded 3D WebGL Model (.gltf)</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>Procedural 3D Environment (Upload .gltf in settings)</span>
                </>
              )}
            </div>

            {/* Orbit Controls Hint Overlay */}
            <div className="absolute top-3 right-3 z-10 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-[11px] text-gray-300 flex items-center gap-2">
              <RotateCw className="w-3.5 h-3.5 text-purple-400" />
              <span>Click & Drag to Orbit | Scroll to Zoom</span>
            </div>
          </>
        )}

        {/* 3D Viewport Procedural Room Representation */}
        {activeTab === "3d" && (
          <div
            data-testid="webgl-canvas-viewport"
            className="w-full h-full relative flex items-center justify-center bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950"
          >
            {/* Grid Floor Mesh */}
            <div
              className="absolute inset-x-8 inset-y-12 border-2 border-indigo-500/40 rounded-xl bg-indigo-950/30 flex flex-wrap items-center justify-center p-6 gap-4 overflow-auto shadow-[0_0_50px_rgba(79,70,229,0.2)]"
              style={{ perspective: 800 }}
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={cn(
                    "relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer transform hover:scale-105",
                    item.type === "stage"
                      ? "w-48 h-20 bg-purple-900/80 border-purple-400 text-purple-200"
                      : item.type === "speaker"
                        ? "w-20 h-20 bg-indigo-900/80 border-indigo-500 text-indigo-200 rounded-md border-dashed"
                        : "w-20 h-20 bg-indigo-900/80 border-indigo-400 text-indigo-100 rounded-full",
                    selectedItemId === item.id && "ring-4 ring-amber-400 border-white scale-110",
                  )}
                >
                  <span className="text-[10px] font-bold text-center leading-tight">
                    {item.label}
                  </span>
                  <span className="text-[9px] text-white/60">({item.width}m)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2D Floorplan View */}
        {activeTab === "2d" && (
          <div
            data-testid="2d-floorplan-viewport"
            className="w-full h-full bg-slate-900 p-8 flex flex-col items-center justify-center space-y-4"
          >
            <div className="w-full max-w-xl h-72 border-2 border-dashed border-gray-500 rounded-xl bg-slate-800/50 relative p-4 flex flex-wrap gap-3 items-center justify-center overflow-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={cn(
                    "px-3 py-1.5 border text-xs font-bold rounded cursor-pointer",
                    item.type === "stage"
                      ? "bg-purple-700 border-purple-400"
                      : item.type === "speaker"
                        ? "bg-indigo-600 border-indigo-300 border-dashed rounded"
                        : "bg-indigo-700 border-indigo-400 rounded-full",
                    selectedItemId === item.id && "border-amber-400 ring-2 ring-amber-400",
                  )}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3D Acoustic Ray-Tracing Simulation View */}
        {activeTab === "acoustic" && (
          <div data-testid="acoustic-canvas-viewport" className="w-full h-full text-black">
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              <div className="xl:col-span-3">
                <AcousticVisualizerCanvas
                  widthMeters={widthMeters}
                  depthMeters={depthMeters}
                  speakers={speakers}
                  rays={simResults.rays}
                  walls={walls}
                  selectedSpeakerId={selectedItemId}
                  onSelectSpeaker={setSelectedItemId}
                  onUpdateSpeaker={handleUpdateSpeaker}
                />
              </div>
              <div className="xl:col-span-2">
                <AcousticSimulationPanel
                  speakers={speakers}
                  walls={walls}
                  results={simResults}
                  selectedSpeakerId={selectedItemId}
                  rayCount={rayCount}
                  onSelectSpeaker={setSelectedItemId}
                  onUpdateSpeaker={handleUpdateSpeaker}
                  onAddSpeaker={() => handleAddItem("speaker")}
                  onRemoveSpeaker={removeItem}
                  onUpdateWall={handleUpdateWall}
                  onUpdateRayCount={setRayCount}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spatial Controls & Table Quantity Simulator */}
      <div className="p-4 bg-white border-t-2 border-black space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Table Count Simulator */}
          <div className="flex items-center gap-3 flex-1 w-full">
            <label className="text-xs font-bold uppercase whitespace-nowrap">
              Test Circular Table Layout:
            </label>
            <input
              type="range"
              min={1}
              max={capacityFit.maxTables}
              value={tableCount}
              onChange={(e) => handleTableCountChange(Number(e.target.value))}
              className="flex-1 accent-purple-600 cursor-pointer"
            />
            <span className="px-3 py-1 border-2 border-black bg-purple-100 font-bold text-xs rounded-md">
              {tableCount} Tables ({tableCount * 8} Guests)
            </span>
          </div>

          {/* Quick Item Addition Primitives */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAddItem("round_table")}
              className="px-3 py-1.5 border-2 border-black bg-white text-black text-xs font-bold rounded-md hover:bg-gray-100 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-purple-600" />+ Table
            </button>
            <button
              type="button"
              onClick={() => handleAddItem("stage")}
              className="px-3 py-1.5 border-2 border-black bg-white text-black text-xs font-bold rounded-md hover:bg-gray-100 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-purple-600" />+ Stage
            </button>
            <button
              type="button"
              onClick={() => handleAddItem("speaker")}
              className="px-3 py-1.5 border-2 border-black bg-white text-black text-xs font-bold rounded-md hover:bg-gray-100 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-purple-600" />+ Speaker
            </button>
          </div>
        </div>

        {/* Capacity Validation Status Banner */}
        <div
          className={cn(
            "p-3 border-2 border-black rounded-lg text-xs font-bold flex items-center justify-between",
            fitsInVenue ? "bg-emerald-50 text-emerald-950" : "bg-rose-50 text-rose-950",
          )}
        >
          <div className="flex items-center gap-2">
            {fitsInVenue ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>
              {fitsInVenue
                ? `Spatial Fit Confirmed: ${items.length} 3D items fit comfortably in ${venueName}.`
                : `Over Capacity Warning: ${items.length} items exceeds max capacity of ${capacityFit.maxTables} tables.`}
            </span>
          </div>
          {selectedItemId && (
            <button
              type="button"
              onClick={() => removeItem(selectedItemId)}
              className="px-2.5 py-1 border border-black bg-rose-600 text-white rounded text-[11px] flex items-center gap-1 hover:bg-rose-700"
            >
              <Trash2 className="w-3 h-3" />
              Delete Selected
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
