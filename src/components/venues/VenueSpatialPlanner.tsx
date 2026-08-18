import React, { useState } from "react";
import { Building, Settings, Save, Link as LinkIcon } from "lucide-react";
import { Venue3DModelViewer } from "./Venue3DModelViewer";
import { isValid3DModelUrl, SpatialItem } from "@/lib/venue3DViewer";
import { cn } from "@/lib/utils";

export interface VenueSpatialPlannerProps {
  venueId?: string;
  venueName?: string;
  initialModelUrl?: string | null;
  widthMeters?: number;
  depthMeters?: number;
  heightMeters?: number;
  onSaveModelUrl?: (url: string) => void;
  onSaveSpatialLayout?: (items: SpatialItem[]) => void;
  className?: string;
}

export const VenueSpatialPlanner: React.FC<VenueSpatialPlannerProps> = ({
  venueId = "v-1",
  venueName = "University Gala Ballroom",
  initialModelUrl = null,
  widthMeters = 30,
  depthMeters = 20,
  heightMeters = 6,
  onSaveModelUrl,
  onSaveSpatialLayout,
  className,
}) => {
  const [modelUrl, setModelUrl] = useState<string>(initialModelUrl || "");
  const [inputUrl, setInputUrl] = useState<string>(initialModelUrl || "");
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [currentLayout, setCurrentLayout] = useState<SpatialItem[]>([]);

  const handleModelUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModelUrl(inputUrl);
    setShowSettings(false);
    if (onSaveModelUrl) onSaveModelUrl(inputUrl);
  };

  const handleLayoutChange = (items: SpatialItem[]) => {
    setCurrentLayout(items);
    if (onSaveSpatialLayout) onSaveSpatialLayout(items);
  };

  return (
    <div className={cn("space-y-6 font-mono", className)}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-2 border-black p-5 bg-white rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-black">
            <Building className="w-5 h-5 text-purple-600" />
            <span>Venue 3D Model & Layout Planner</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Fly around {venueName} in WebGL 3D space and test table setup configurations before booking.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="px-4 py-2 border-2 border-black bg-purple-100 hover:bg-purple-200 text-purple-950 font-bold text-xs uppercase rounded-md flex items-center gap-1.5 transition-colors"
        >
          <Settings className="w-4 h-4" />
          {showSettings ? "Close Model Settings" : "3D Model Settings"}
        </button>
      </div>

      {/* Settings Panel for Model URL Upload/Input (#3447) */}
      {showSettings && (
        <form
          onSubmit={handleModelUrlSubmit}
          className="border-2 border-black p-5 bg-purple-50 rounded-xl space-y-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
        >
          <h4 className="font-bold text-sm uppercase flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-purple-600" />
            Configure 3D WebGL Model File (.gltf / .glb / .obj)
          </h4>
          <p className="text-xs font-sans text-gray-700">
            Upload or link a standard 3D web model of the venue building for real-time WebGL rendering.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://cdn.campus.edu/models/ballroom.gltf"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="flex-1 px-3 py-2 border-2 border-black bg-white font-sans text-xs rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <button
              type="submit"
              className="px-4 py-2 border-2 border-black bg-black text-white font-bold text-xs uppercase rounded-md hover:bg-gray-800 flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              Save 3D Model
            </button>
          </div>
        </form>
      )}

      {/* 3D Model Viewer Canvas Component */}
      <Venue3DModelViewer
        modelUrl={modelUrl}
        venueName={venueName}
        widthMeters={widthMeters}
        depthMeters={depthMeters}
        heightMeters={heightMeters}
        onLayoutChange={handleLayoutChange}
      />
    </div>
  );
};
