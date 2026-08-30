import React, { useState } from "react";
import {
  Video,
  Zap,
  HardDrive,
  Trash2,
  CheckCircle2,
  DollarSign,
  Play,
  Settings,
  Layers,
  UploadCloud,
  FileVideo,
  Sparkles,
  Server,
  ArrowRight,
} from "lucide-react";
import {
  VideoTranscodeJob,
  TranscodeMetrics,
  calculateTranscodeMetrics,
  processVideoTranscodeJob,
  getHlsVariantManifests,
} from "@/lib/clubPitchVideoCompression";
import { cn } from "@/lib/utils";

export interface ClubPitchVideoCompressionWidgetProps {
  clubId?: string;
  clubName?: string;
  initialJob?: VideoTranscodeJob | null;
  onJobCompleted?: (job: VideoTranscodeJob) => void;
  className?: string;
}

export const MOCK_COMPLETED_JOB: VideoTranscodeJob = {
  id: "job-pitch-4k",
  clubId: "club-cs-1",
  pitchTitle: "Join Computer Science Society! (60-Sec 4K Pitch)",
  rawS3Key: "raw-uploads/prores_4k_pitch_500mb.mov",
  rawFileSizeMb: 500.0,
  compressedSizeMb: 24.5,
  bandwidthSavedPct: 95.1,
  masterM3u8Url: "https://cdn.campus.edu/hls/prores_4k_pitch_500mb/master.m3u8",
  resolutions: ["1080p", "720p", "480p"],
  status: "raw_file_purged",
  createdAt: new Date().toISOString(),
};

export const ClubPitchVideoCompressionWidget: React.FC<ClubPitchVideoCompressionWidgetProps> = ({
  clubId = "club-cs-1",
  clubName = "Computer Science Society",
  initialJob = MOCK_COMPLETED_JOB,
  onJobCompleted,
  className,
}) => {
  const [job, setJob] = useState<VideoTranscodeJob | null>(initialJob);
  const [selectedResolution, setSelectedResolution] = useState<string>("1080p");
  const [isSimulatingUpload, setIsSimulatingUpload] = useState<boolean>(false);
  const [simStep, setSimStep] = useState<number>(0);
  const [notice, setNotice] = useState<string | null>(null);

  const metrics: TranscodeMetrics | null = job
    ? calculateTranscodeMetrics(job.rawFileSizeMb, job.compressedSizeMb || 24.5)
    : null;

  const hlsVariants = job ? getHlsVariantManifests(job.masterM3u8Url || "") : [];

  const handleSimulateRawUpload = () => {
    setIsSimulatingUpload(true);
    setSimStep(1); // Uploading raw S3

    const newJob: VideoTranscodeJob = {
      id: `job-sim-${Date.now()}`,
      clubId,
      pitchTitle: `${clubName} 60-Sec Pitch (Raw 4K Upload)`,
      rawS3Key: "raw-uploads/iphone_prores_4k.mov",
      rawFileSizeMb: 500.0,
      resolutions: [],
      status: "uploaded",
      createdAt: new Date().toISOString(),
    };
    setJob(newJob);

    setTimeout(() => {
      setSimStep(2); // Transcoding MediaConvert
      setJob((prev) => (prev ? { ...prev, status: "transcoding" } : prev));
    }, 1500);

    setTimeout(() => {
      setSimStep(3); // Purging S3 & Serving HLS
      const completed = processVideoTranscodeJob(newJob);
      setJob(completed);
      setIsSimulatingUpload(false);
      if (onJobCompleted) onJobCompleted(completed);

      setNotice("Video pitch successfully transcoded into HLS! 500MB raw file purged from S3.");
      setTimeout(() => setNotice(null), 5000);
    }, 3500);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-violet-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-violet-950">
            <Video className="w-5 h-5 text-violet-700" />
            <span>"Club Pitch" Video Compression Pipeline — {clubName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Serverless video transcoding pipeline. Converts massive 4K 500MB raw uploads into HLS segments and purges raw S3 files.
          </p>
        </div>

        <button
          type="button"
          disabled={isSimulatingUpload}
          onClick={handleSimulateRawUpload}
          className="px-4 py-2 border-2 border-black bg-black text-white hover:bg-gray-800 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5 disabled:opacity-50"
        >
          <UploadCloud className="w-4 h-4 text-violet-400" />
          <span>Simulate 500MB Raw 4K Upload</span>
        </button>
      </div>

      {/* Confirmation Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Pipeline Step Progress Bar (when simulating) */}
      {isSimulatingUpload && (
        <div className="p-4 bg-slate-900 text-white border-b-2 border-black space-y-2 font-mono text-xs">
          <div className="flex justify-between font-bold text-violet-300">
            <span>Serverless Transcoding Pipeline Active...</span>
            <span>Step {simStep} of 3</span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
            <div
              className="bg-violet-500 h-full transition-all duration-500"
              style={{ width: `${(simStep / 3) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-gray-400">
            <span className={cn(simStep >= 1 && "text-emerald-400 font-bold")}>1. Upload S3</span>
            <span className={cn(simStep >= 2 && "text-emerald-400 font-bold")}>2. Lambda / MediaConvert</span>
            <span className={cn(simStep >= 3 && "text-emerald-400 font-bold")}>3. Purge Raw & Serve HLS</span>
          </div>
        </div>
      )}

      {/* Overview Compression Telemetry Metrics Grid */}
      {job && metrics && (
        <div className="p-5 bg-slate-50 border-b-2 border-black grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Raw S3 Upload</span>
            <span className="text-2xl font-black text-rose-600">{metrics.rawSizeMb.toFixed(1)} MB</span>
            <span className="text-[11px] font-sans text-gray-600 block">4K ProRes File</span>
          </div>

          <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Compressed HLS Size</span>
            <span className="text-2xl font-black text-emerald-600">{metrics.compressedSizeMb.toFixed(1)} MB</span>
            <span className="text-[11px] font-sans text-gray-600 block">Multi-bitrate HLS (.m3u8)</span>
          </div>

          <div className="p-3.5 border-2 border-black rounded-lg bg-violet-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] font-bold text-violet-900 uppercase block">Bandwidth Savings</span>
            <span className="text-2xl font-black text-violet-700">{metrics.bandwidthSavedPct}%</span>
            <span className="text-[11px] font-sans text-violet-900 block font-medium">
              {metrics.bandwidthSavingsMb} MB saved / play
            </span>
          </div>

          <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Estimated Egress Cost Saved</span>
            <span className="text-2xl font-black text-emerald-600">${metrics.costSavingsUsd}</span>
            <span className="text-[11px] font-sans text-gray-600 block">Per 1,000 video plays</span>
          </div>
        </div>
      )}

      {/* Main Grid: HLS Player & Pipeline Architecture Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Multi-Bitrate HLS Video Player Canvas */}
        <div className="lg:col-span-2 p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Play className="w-4 h-4 text-violet-600" />
              Transcoded HLS Video Player — {job?.pitchTitle || "Video Pitch"}
            </h4>

            {/* Resolution Selector */}
            <div className="flex items-center gap-1 text-xs">
              <span className="font-bold text-gray-600 text-[10px] uppercase">Quality:</span>
              {(["1080p", "720p", "480p"] as const).map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => setSelectedResolution(res)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-bold rounded border font-mono",
                    selectedResolution === res
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-slate-100 text-slate-700 border-slate-300"
                  )}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          {/* Simulated HLS Video Screen */}
          <div className="relative aspect-video bg-slate-900 border-2 border-black rounded-lg flex flex-col justify-between p-4 text-white overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center z-10">
              <span className="px-2.5 py-1 bg-violet-600 text-white font-bold text-[10px] rounded uppercase flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-300" /> HLS STREAMING ACTIVE ({selectedResolution})
              </span>
              <span className="text-[10px] font-mono bg-black/60 px-2 py-1 rounded text-gray-300">
                {selectedResolution === "1080p" ? "4.5 Mbps" : selectedResolution === "720p" ? "2.5 Mbps" : "1.2 Mbps"}
              </span>
            </div>

            {/* HLS Video Placeholder Graphics */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950 opacity-90 p-6 text-center space-y-2">
              <FileVideo className="w-12 h-12 text-violet-400 animate-pulse" />
              <p className="font-bold text-sm text-white font-mono">{job?.pitchTitle}</p>
              <p className="text-xs font-sans text-gray-300 max-w-md">
                Playing optimized HLS variant segment from CDN ({selectedResolution}). 500MB raw source file purged.
              </p>
            </div>

            {/* Manifest URL Info */}
            <div className="z-10 bg-slate-950/80 p-2 rounded text-[10px] font-mono text-gray-300 flex justify-between items-center border border-slate-800">
              <span className="truncate">Master: {job?.masterM3u8Url}</span>
              <span className="text-emerald-400 font-bold shrink-0 ml-2">200 OK</span>
            </div>
          </div>
        </div>

        {/* Pipeline Architecture & S3 Purge Status */}
        <div className="lg:col-span-1 p-5 bg-slate-50 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Server className="w-4 h-4 text-violet-600" />
            Pipeline Architecture Status
          </h4>

          {/* Purge Status Badge */}
          <div className="p-3 bg-emerald-50 border-2 border-black rounded-lg text-xs font-sans space-y-1 text-emerald-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-1.5 font-bold font-mono text-emerald-900">
              <Trash2 className="w-4 h-4 text-emerald-600" />
              Raw Upload Purged
            </div>
            <p className="text-[11px] leading-relaxed">
              The 500MB raw ProRes file was automatically deleted from the S3 bucket after HLS transcoding to prevent storage bloat.
            </p>
          </div>

          {/* HLS Variant List */}
          <div className="p-3 border-2 border-black rounded-lg bg-white space-y-2 text-xs font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">HLS Playlist Variants:</span>
            <div className="space-y-1">
              {hlsVariants.map((v) => (
                <div key={v.resolution} className="p-1.5 bg-slate-50 border border-slate-200 rounded flex justify-between items-center text-[11px]">
                  <span className="font-bold text-violet-900">{v.resolution}</span>
                  <span className="text-gray-600">{v.bandwidthKbps} Kbps</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
