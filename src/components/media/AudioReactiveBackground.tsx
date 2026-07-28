import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ShaderPipeline,
  ShaderPreset,
  AudioData,
} from "@/lib/webgl/shaderPipeline";
import {
  Mic,
  Upload,
  Play,
  Pause,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AudioReactiveBackgroundProps {
  className?: string;
  defaultPreset?: ShaderPreset;
  interactive?: boolean;
  opacity?: number;
}

export const AudioReactiveBackground: React.FC<AudioReactiveBackgroundProps> = ({
  className = "",
  defaultPreset = "neonPulse",
  interactive = true,
  opacity = 0.85,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pipelineRef = useRef<ShaderPipeline | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Audio Context & Analyser refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // State
  const [preset, setPreset] = useState<ShaderPreset>(defaultPreset);
  const [sourceType, setSourceType] = useState<"microphone" | "file" | "demo">("demo");
  const [sensitivity, setSensitivity] = useState<number>(1.2);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Initialize WebGL pipeline
  useEffect(() => {
    if (!canvasRef.current) return;

    const pipeline = new ShaderPipeline(canvasRef.current);
    pipeline.setPreset(preset);
    pipelineRef.current = pipeline;

    const handleResize = () => {
      if (canvasRef.current && pipelineRef.current) {
        pipelineRef.current.resize(
          canvasRef.current.parentElement?.clientWidth || window.innerWidth,
          canvasRef.current.parentElement?.clientHeight || window.innerHeight
        );
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      pipeline.destroy();
    };
  }, []);

  // Update preset
  useEffect(() => {
    if (pipelineRef.current) {
      pipelineRef.current.setPreset(preset);
    }
  }, [preset]);

  // Audio analyzer setup
  const initAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }

    if (!analyserRef.current && audioCtxRef.current) {
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
    }
  }, []);

  // Switch audio source
  const handleSourceChange = async (type: "microphone" | "file" | "demo") => {
    setSourceType(type);
    initAudioContext();

    // Clean up existing media stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (type === "microphone") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        if (audioCtxRef.current && analyserRef.current) {
          if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
          const micSource = audioCtxRef.current.createMediaStreamSource(stream);
          micSource.connect(analyserRef.current);
          sourceNodeRef.current = micSource;
          setIsPlaying(true);
        }
      } catch (err) {
        console.error("Microphone access denied:", err);
        setSourceType("demo");
      }
    } else if (type === "file") {
      if (audioRef.current && audioCtxRef.current && analyserRef.current) {
        if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
        try {
          const mediaSource = audioCtxRef.current.createMediaElementSource(audioRef.current);
          mediaSource.connect(analyserRef.current);
          analyserRef.current.connect(audioCtxRef.current.destination);
          sourceNodeRef.current = mediaSource;
        } catch {
          // MediaElementSource might already be attached
        }
      }
    } else {
      // Demo synth mode
      if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
      setIsPlaying(true);
    }
  };

  // Audio File Selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFileName(file.name);
    const objectUrl = URL.createObjectURL(file);

    if (audioRef.current) {
      audioRef.current.src = objectUrl;
      audioRef.current.play();
      setIsPlaying(true);
      handleSourceChange("file");
    }
  };

  const togglePlayPause = () => {
    if (sourceType === "file" && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  // 60FPS Render loop
  useEffect(() => {
    const dataArray = new Uint8Array(64);

    const renderLoop = () => {
      let audioData: AudioData = {
        bass: 0,
        mid: 0,
        treble: 0,
        fftArray: dataArray,
      };

      if (analyserRef.current && isPlaying && sourceType !== "demo") {
        analyserRef.current.getByteFrequencyData(dataArray);

        // Average low (0-15), mid (16-40), treble (41-64)
        let bassSum = 0;
        let midSum = 0;
        let trebleSum = 0;

        for (let i = 0; i < 15; i++) bassSum += dataArray[i];
        for (let i = 15; i < 40; i++) midSum += dataArray[i];
        for (let i = 40; i < 64; i++) trebleSum += dataArray[i];

        audioData = {
          bass: bassSum / (15 * 255),
          mid: midSum / (25 * 255),
          treble: trebleSum / (24 * 255),
          fftArray: dataArray,
        };
      } else if (sourceType === "demo" || isPlaying) {
        // Simulated audio wave pulse when in demo mode
        const t = Date.now() / 1000;
        audioData = {
          bass: (Math.sin(t * 3.0) + 1.0) * 0.4 + 0.1,
          mid: (Math.cos(t * 2.0) + 1.0) * 0.35 + 0.1,
          treble: (Math.sin(t * 4.5) + 1.0) * 0.3 + 0.1,
          fftArray: dataArray,
        };
      }

      if (pipelineRef.current) {
        pipelineRef.current.render(audioData, sensitivity);
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, sourceType, sensitivity]);

  return (
    <div
      className={cn(
        "relative w-full h-full min-h-[350px] overflow-hidden rounded-xl bg-slate-950 border border-slate-800 shadow-2xl",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 pointer-events-none"
        style={{ opacity }}
      />

      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} className="hidden" />

      {interactive && (
        <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setControlsOpen(!controlsOpen)}
            className="bg-slate-900/80 backdrop-blur-md border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            <Sliders className="w-4 h-4 mr-2 text-cyan-400" />
            {controlsOpen ? "Hide Controls" : "Visualizer Controls"}
          </Button>

          {controlsOpen && (
            <div className="w-72 p-4 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl text-slate-100 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-semibold text-slate-100">
                    Shader Visualizer
                  </span>
                </div>
                <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  60 FPS GPU
                </span>
              </div>

              {/* Preset Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400">
                  GLSL Preset
                </label>
                <Select
                  value={preset}
                  onValueChange={(v) => setPreset(v as ShaderPreset)}
                >
                  <SelectTrigger className="bg-slate-800/80 border-slate-700 text-xs text-slate-200">
                    <SelectValue placeholder="Select Shader" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="neonPulse">Neon Pulse</SelectItem>
                    <SelectItem value="cyberTunnel">Cyber Tunnel</SelectItem>
                    <SelectItem value="plasmaWaves">Plasma Waves</SelectItem>
                    <SelectItem value="audioGrid">Audio Grid Matrix</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Source Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400">
                  Audio Source
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button
                    size="sm"
                    variant={sourceType === "demo" ? "default" : "outline"}
                    onClick={() => handleSourceChange("demo")}
                    className={cn(
                      "text-xs px-2 h-8",
                      sourceType === "demo"
                        ? "bg-purple-600 hover:bg-purple-700 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-300"
                    )}
                  >
                    Demo
                  </Button>

                  <Button
                    size="sm"
                    variant={sourceType === "microphone" ? "default" : "outline"}
                    onClick={() => handleSourceChange("microphone")}
                    className={cn(
                      "text-xs px-2 h-8 gap-1",
                      sourceType === "microphone"
                        ? "bg-purple-600 hover:bg-purple-700 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-300"
                    )}
                  >
                    <Mic className="w-3 h-3 text-cyan-400" /> Mic
                  </Button>

                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div
                      className={cn(
                        "inline-flex items-center justify-center rounded-md text-xs font-medium h-8 w-full border px-2 gap-1 transition-colors",
                        sourceType === "file"
                          ? "bg-purple-600 border-purple-500 text-white"
                          : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                      )}
                    >
                      <Upload className="w-3 h-3 text-emerald-400" /> File
                    </div>
                  </label>
                </div>
              </div>

              {audioFileName && sourceType === "file" && (
                <div className="text-[11px] font-mono text-emerald-400 truncate bg-emerald-950/40 p-1.5 rounded border border-emerald-800/40">
                  🎵 {audioFileName}
                </div>
              )}

              {/* Sensitivity Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Beat Sensitivity</span>
                  <span className="font-mono text-purple-300">{sensitivity.toFixed(1)}x</span>
                </div>
                <Slider
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  value={[sensitivity]}
                  onValueChange={([val]) => setSensitivity(val)}
                  className="py-1"
                />
              </div>

              {/* Media Controls */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={togglePlayPause}
                  className="text-slate-200 hover:bg-slate-800 h-8"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 mr-1 text-amber-400" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-1 text-emerald-400" /> Play
                    </>
                  )}
                </Button>

                {sourceType === "file" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={toggleMute}
                    className="text-slate-300 hover:bg-slate-800 h-8"
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-red-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-cyan-400" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
