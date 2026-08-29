import React, { useState, useMemo } from "react";
import { Box, Eye, Layers, Plus, Trash2, CheckCircle2, AlertCircle, RotateCw, Smartphone, Map } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { ARButton, XR } from "@react-three/xr";
import { Line, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import {
  SpatialItem,
  isValid3DModelUrl,
  calculateTableCapacityFit,
  generateTableGridPrimitives,
} from "@/lib/venue3DViewer";
import { generateHolographicPath } from "@/lib/arPathfinder";
import { cn } from "@/lib/utils";

// --- Issue #4914: The 3D AR Scene Sub-component ---
const ARNavigatorScene = ({ items, targetId }: { items: SpatialItem[], targetId: string | null }) => {
  const targetItem = items.find(i => i.id === targetId);

  const pathPoints = useMemo(() => {
    if (!targetItem) return [];
    return generateHolographicPath(
      { x: 0, y: -0.5, z: 0 }, 
      { x: targetItem.x, y: targetItem.y, z: targetItem.z }
    );
  }, [targetItem]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      {items.map((item) => (
        <mesh key={item.id} position={[item.x, item.y, item.z]}>
          <cylinderGeometry args={[item.width / 2, item.width / 2, 0.75, 32]} />
          <meshStandardMaterial 
            color={item.id === targetId ? "#10b981" : "#4f46e5"} 
            opacity={0.8} 
            transparent 
          />
          <Text position={[0, 1, 0]} fontSize={0.2} color="white" anchorX="center" anchorY="middle">
            {item.label}
          </Text>
        </mesh>
      ))}
      {targetItem && pathPoints.length > 0 && (
        <Line points={pathPoints} color="#10b981" lineWidth={10} dashed={true} dashSize={0.5} dashScale={2}>
          <meshBasicMaterial color="#10b981" toneMapped={false} />
        </Line>
      )}
    </>
  );
};

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
  const [activeTab, setActiveTab] = useState<"3d" | "2d" | "ar">("3d");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [arSessionActive, setArSessionActive] = useState(false);

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
    const newItem: SpatialItem = {
      id: `item-${Date.now()}`,
      type,
      label: type === "stage" ? "Main Stage" : `${type === "round_table" ? "Table" : "Item"} #${items.length + 1}`,
      x: 0,
      y: type === "stage" ? 0.4 : 0.75,
      z: 0,
      rotationY: 0,
      width: type === "stage" ? 6 : 1.8,
      depth: type === "stage" ? 4 : 1.8,
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

  const fitsInVenue = items.length <= capacityFit.maxTables;
  const targetSponsorId = items[0]?.id || null; // For AR demo purposes

  return (
    <div className={cn("border-2 border-black rounded-xl bg-white overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-mono", className)}>
      {/* Top Header & Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-peach/30 border-b-2 border-black">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-black">
            <Box className="w-5 h-5 text-purple-600" />
            <span>3D Spatial Venue Planner — {venueName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-0.5">
            Dimensions: {widthMeters}m x {depthMeters}m x {heightMeters}m | Max Circular Capacity: {capacityFit.maxTables} tables ({capacityFit.maxGuests} guests)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex border-2 border-black rounded-md overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setActiveTab("3d")}
              className={cn("px-3 py-1.5 text-xs font-bold uppercase flex items-center gap-1.5 transition-colors", activeTab === "3d" ? "bg-black text-white" : "hover:bg-gray-100")}
            >
              <Eye className="w-3.5 h-3.5" /> WebGL 3D View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("2d")}
              className={cn("px-3 py-1.5 text-xs font-bold uppercase flex items-center gap-1.5 transition-colors", activeTab === "2d" ? "bg-black text-white" : "hover:bg-gray-100")}
            >
              <Layers className="w-3.5 h-3.5" /> 2D Floorplan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ar")}
              className={cn("px-3 py-1.5 text-xs font-bold uppercase flex items-center gap-1.5 transition-colors", activeTab === "ar" ? "bg-emerald-500 text-black" : "hover:bg-emerald-100 text-emerald-900")}
            >
              <Smartphone className="w-3.5 h-3.5" /> AR Navigator
            </button>
          </div>
        </div>
      </div>

      {/* Main Viewport Area */}
      <div className="relative h-[480px] bg-slate-950 text-white overflow-hidden flex items-center justify-center select-none">
        
        {/* Render Original Pseudo-3D and 2D Views */}
        {activeTab !== "ar" && (
          <>
            <div className="absolute top-3 left-3 z-10 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-xs font-bold flex items-center gap-2">
              {hasValidModel ? (
                <><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" /><span>Loaded 3D WebGL Model (.gltf)</span></>
              ) : (
                <><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span>Procedural 3D Environment</span></>
              )}
            </div>
            {activeTab === "3d" ? (
              <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950">
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
                        item.type === "stage" ? "w-48 h-20 bg-purple-900/80 border-purple-400 text-purple-200" : "w-20 h-20 bg-indigo-900/80 border-indigo-400 text-indigo-100 rounded-full",
                        selectedItemId === item.id && "ring-4 ring-amber-400 border-white scale-110"
                      )}
                    >
                      <span className="text-[10px] font-bold text-center leading-tight">{item.label}</span>
                      <span className="text-[9px] text-white/60">({item.width}m)</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="w-full h-full bg-slate-900 p-8 flex flex-col items-center justify-center space-y-4">
                <div className="w-full max-w-xl h-72 border-2 border-dashed border-gray-500 rounded-xl bg-slate-800/50 relative p-4 flex flex-wrap gap-3 items-center justify-center overflow-auto">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={cn(
                        "px-3 py-1.5 border text-xs font-bold rounded cursor-pointer",
                        item.type === "stage" ? "bg-purple-700 border-purple-400" : "bg-indigo-700 border-indigo-400 rounded-full",
                        selectedItemId === item.id && "border-amber-400 ring-2 ring-amber-400"
                      )}
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Issue #4914: Render True WebXR AR Engine */}
        {activeTab === "ar" && (
          <div className="w-full h-full relative">
            {!arSessionActive && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-11/12 max-w-md bg-white border-2 border-black rounded-xl p-4 shadow-[4px_4px_0_0_#10b981]">
                <span className="px-2 py-1 bg-emerald-100 text-emerald-800 border border-emerald-900 font-black text-[10px] uppercase rounded">85% Skill Match</span>
                <h3 className="text-black font-black uppercase mt-2">Google Engineering</h3>
                <p className="text-xs text-gray-600 mt-1">Booth is actively hiring for your tech stack!</p>
                <div className="mt-4 flex gap-2">
                  <ARButton 
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black border-2 border-black font-black uppercase text-xs py-3 rounded-lg flex items-center justify-center gap-2"
                    sessionInit={{ requiredFeatures: ['hit-test'] }}
                  >
                    Take Me There (AR) <Smartphone className="w-4 h-4" />
                  </ARButton>
                </div>
              </div>
            )}
            <Canvas camera={{ position: [0, 5, 10], fov: 60 }}>
              <XR onSessionStart={() => setArSessionActive(true)} onSessionEnd={() => setArSessionActive(false)}>
                {!arSessionActive && <OrbitControls />}
                <ARNavigatorScene items={items} targetId={targetSponsorId} />
              </XR>
            </Canvas>
          </div>
        )}
      </div>

      {/* Spatial Controls & Table Quantity Simulator (Kept intact!) */}
      {activeTab !== "ar" && (
        <div className="p-4 bg-white border-t-2 border-black space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 w-full">
              <label className="text-xs font-bold uppercase whitespace-nowrap">Test Circular Table Layout:</label>
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
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => handleAddItem("round_table")} className="px-3 py-1.5 border-2 border-black bg-white text-black text-xs font-bold rounded-md hover:bg-gray-100 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5 text-purple-600" /> + Table
              </button>
              <button type="button" onClick={() => handleAddItem("stage")} className="px-3 py-1.5 border-2 border-black bg-white text-black text-xs font-bold rounded-md hover:bg-gray-100 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5 text-purple-600" /> + Stage
              </button>
            </div>
          </div>
          <div className={cn("p-3 border-2 border-black rounded-lg text-xs font-bold flex items-center justify-between", fitsInVenue ? "bg-emerald-50 text-emerald-950" : "bg-rose-50 text-rose-950")}>
            <div className="flex items-center gap-2">
              {fitsInVenue ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
              <span>{fitsInVenue ? `Spatial Fit Confirmed: ${items.length} 3D items fit.` : `Over Capacity Warning: Exceeds ${capacityFit.maxTables} tables.`}</span>
            </div>
            {selectedItemId && (
              <button type="button" onClick={() => removeItem(selectedItemId)} className="px-2.5 py-1 border border-black bg-rose-600 text-white rounded text-[11px] flex items-center gap-1 hover:bg-rose-700">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
