import React, { useState, useEffect } from "react";
import {
  Video,
  Settings,
  Wifi,
  WifiOff,
  Gauge,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Info,
} from "lucide-react";
import {
  StreamResolution,
  QualitySelectionMode,
  NetworkQualityState,
  QualityAdaptationResult,
  determineOptimalQuality,
  generateHlsManifestLevels,
} from "@/lib/adaptiveVideoQuality";
import { cn } from "@/lib/utils";

export interface AdaptiveVideoPlayerProps {
  streamId?: string;
  streamTitle?: string;
  posterUrl?: string;
  masterM3u8Url?: string;
  initialQualityMode?: QualitySelectionMode;
  initialNetworkState?: NetworkQualityState;
  onQualityChange?: (result: QualityAdaptationResult) => void;
  className?: string;
}

export const MOCK_FAST_NETWORK: NetworkQualityState = {
  effectiveType: "4g",
  downlinkMbps: 8.5,
  rttMs: 35,
  bufferHealthSec: 6.5,
  packetLossRatio: 0.0,
};

export const MOCK_UNSTABLE_WIFI: NetworkQualityState = {
  effectiveType: "3g",
  downlinkMbps: 1.2,
  rttMs: 180,
  bufferHealthSec: 1.8, // Low buffer!
  packetLossRatio: 0.04,
};

export const MOCK_POOR_3G: NetworkQualityState = {
  effectiveType: "2g",
  downlinkMbps: 0.4,
  rttMs: 340,
  bufferHealthSec: 0.8, // Critical buffer!
  packetLossRatio: 0.14,
};

export const AdaptiveVideoPlayer: React.FC<AdaptiveVideoPlayerProps> = ({
  streamId = "stream-panel-101",
  streamTitle = "Virtual Tech Leaders Panel: Future of AI & Engineering",
  posterUrl = "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80",
  masterM3u8Url = "https://live.campus.edu/hls/panel_stream/master.m3u8",
  initialQualityMode = "auto",
  initialNetworkState = MOCK_FAST_NETWORK,
  onQualityChange,
  className,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [selectionMode, setSelectionMode] = useState<QualitySelectionMode>(initialQualityMode);
  const [networkState, setNetworkState] = useState<NetworkQualityState>(initialNetworkState);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);

  const adaptation: QualityAdaptationResult = determineOptimalQuality(networkState, selectionMode);
  const hlsLevels = generateHlsManifestLevels(masterM3u8Url);

  useEffect(() => {
    if (onQualityChange) onQualityChange(adaptation);
  }, [adaptation.targetQuality, selectionMode, networkState.bufferHealthSec]);

  const handleSelectQualityMode = (mode: QualitySelectionMode) => {
    setSelectionMode(mode);
    setShowSettingsMenu(false);
  };

  const handleSimulateNetwork = (preset: NetworkQualityState) => {
    setNetworkState(preset);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-slate-900 text-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Top Header Bar */}
      <div className="p-4 bg-slate-800 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-bold uppercase truncate">
          <Video className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{streamTitle}</span>
        </div>

        {/* Dynamic Quality Badge (#3586) */}
        <div className="flex items-center gap-2">
          <span
            data-testid="quality-badge"
            className={cn(
              "px-3 py-1 rounded border text-[11px] font-bold uppercase flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]",
              adaptation.isDegraded
                ? "bg-amber-400 text-black border-black"
                : "bg-emerald-400 text-black border-black"
            )}
          >
            {adaptation.isDegraded ? (
              <AlertTriangle className="w-3.5 h-3.5 text-black" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-black" />
            )}
            <span>
              {adaptation.selectionMode === "auto" ? "Auto: " : "Manual: "}
              {adaptation.targetQuality} ({adaptation.bitrateKbps} Kbps)
            </span>
          </span>
        </div>
      </div>

      {/* Embedded Stream Video Canvas */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group">
        <img
          src={posterUrl}
          alt={streamTitle}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            isPlaying ? "opacity-90" : "opacity-40"
          )}
        />

        {/* Video Controls Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 p-4 flex flex-col justify-between opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Live Indicator */}
          <div className="flex justify-between items-center">
            <span className="px-2.5 py-1 bg-rose-600 text-white font-bold text-[10px] rounded uppercase flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" /> LIVE
            </span>

            {/* Gear Resolution Settings Dropdown Button (#3586) */}
            <div className="relative">
              <button
                type="button"
                aria-label="Quality settings"
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="p-2 bg-slate-900/80 hover:bg-black border border-white/20 rounded text-white flex items-center gap-1.5 font-bold text-xs"
              >
                <Settings className="w-4 h-4 text-emerald-400" />
                <span>{adaptation.targetQuality}</span>
              </button>

              {/* Quality Selection Menu */}
              {showSettingsMenu && (
                <div
                  data-testid="quality-settings-menu"
                  className="absolute right-0 top-10 w-56 bg-slate-900 border-2 border-black rounded-lg p-2 shadow-2xl z-30 font-mono text-xs space-y-1"
                >
                  <div className="px-2 py-1 text-[10px] font-bold text-gray-400 border-b border-slate-700 uppercase">
                    Playback Resolution
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectQualityMode("auto")}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between font-bold",
                      selectionMode === "auto" ? "bg-emerald-600 text-white" : "hover:bg-slate-800 text-gray-200"
                    )}
                  >
                    <span>Auto (Adaptive)</span>
                    <span className="text-[10px] opacity-80">{adaptation.targetQuality}</span>
                  </button>

                  {(["1080p", "720p", "480p", "360p"] as StreamResolution[]).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => handleSelectQualityMode(res)}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between text-xs",
                        selectionMode === res ? "bg-emerald-600 text-white font-bold" : "hover:bg-slate-800 text-gray-200"
                      )}
                    >
                      <span>{res}</span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {res === "1080p" ? "4.5 Mbps" : res === "720p" ? "2.5 Mbps" : res === "480p" ? "1.2 Mbps" : "600 Kbps"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Player Bar */}
          <div className="flex items-center justify-between text-xs pt-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded text-white"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded text-white"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            <span className="text-[11px] text-gray-300 font-sans">
              Adaptive HLS Stream • Active Buffer: {networkState.bufferHealthSec.toFixed(1)}s
            </span>
          </div>
        </div>
      </div>

      {/* Network & Buffer Telemetry Diagnostics Panel (#3586) */}
      <div className="p-4 bg-slate-800 border-t-2 border-black space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            Network & Buffer Diagnostics
          </h4>
          <span className="text-[10px] text-gray-400 font-sans">NetworkInformation API Active</span>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
          <div className="p-2.5 bg-slate-900 border border-slate-700 rounded space-y-0.5 font-mono">
            <span className="text-[10px] text-gray-400 uppercase block">Downlink Speed</span>
            <span className="font-bold text-white text-sm">{networkState.downlinkMbps?.toFixed(1)} Mbps</span>
          </div>

          <div className="p-2.5 bg-slate-900 border border-slate-700 rounded space-y-0.5 font-mono">
            <span className="text-[10px] text-gray-400 uppercase block">Buffer Health</span>
            <span
              className={cn(
                "font-bold text-sm",
                networkState.bufferHealthSec < 2.0 ? "text-rose-400" : "text-emerald-400"
              )}
            >
              {networkState.bufferHealthSec.toFixed(1)}s
            </span>
          </div>

          <div className="p-2.5 bg-slate-900 border border-slate-700 rounded space-y-0.5 font-mono">
            <span className="text-[10px] text-gray-400 uppercase block">Latency (RTT)</span>
            <span className="font-bold text-white text-sm">{networkState.rttMs} ms</span>
          </div>

          <div className="p-2.5 bg-slate-900 border border-slate-700 rounded space-y-0.5 font-mono">
            <span className="text-[10px] text-gray-400 uppercase block">Bitrate Target</span>
            <span className="font-bold text-emerald-400 text-sm">{adaptation.bitrateKbps} Kbps</span>
          </div>
        </div>

        {/* Adaptation Log Reason */}
        <div className="p-2.5 bg-slate-900 border border-slate-700 rounded text-xs font-sans text-gray-300 flex items-start gap-2">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{adaptation.reason}</span>
        </div>

        {/* Network Condition Presets for Testing (#3586) */}
        <div className="pt-2 border-t border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase">Simulate Wi-Fi Conditions:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleSimulateNetwork(MOCK_FAST_NETWORK)}
              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[11px] font-bold text-emerald-400 border border-emerald-500/30"
            >
              ⚡ Fast Campus Fiber (8.5 Mbps)
            </button>
            <button
              type="button"
              onClick={() => handleSimulateNetwork(MOCK_UNSTABLE_WIFI)}
              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[11px] font-bold text-amber-400 border border-amber-500/30"
            >
              📶 Unstable Wi-Fi (1.2 Mbps)
            </button>
            <button
              type="button"
              onClick={() => handleSimulateNetwork(MOCK_POOR_3G)}
              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[11px] font-bold text-rose-400 border border-rose-500/30"
            >
              🐢 Poor 3G (0.4 Mbps)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
