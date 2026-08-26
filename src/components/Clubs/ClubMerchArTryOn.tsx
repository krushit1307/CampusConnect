import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Sparkles,
  Download,
  Share2,
  Shirt,
  RefreshCw,
  Check,
} from "lucide-react";
import {
  clubMerchArService,
  calculateChestPlacement,
  ClubMerchandise,
  ChestCoordinates,
} from "@/services/clubMerchArService";
import { toast } from "sonner";

interface ClubMerchArTryOnProps {
  clubId: string;
  clubName: string;
  initialMerch?: ClubMerchandise[];
}

export const ClubMerchArTryOn: React.FC<ClubMerchArTryOnProps> = ({
  clubId,
  clubName,
  initialMerch,
}) => {
  const [merchList, setMerchList] = useState<ClubMerchandise[]>(initialMerch || []);
  const [selectedMerch, setSelectedMerch] = useState<ClubMerchandise | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [snapshotTaken, setSnapshotTaken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);

  // Fallback demo merch if database is fresh
  useEffect(() => {
    const loadMerch = async () => {
      if (initialMerch && initialMerch.length > 0) {
        setSelectedMerch(initialMerch[0]);
        return;
      }
      setLoading(true);
      const data = await clubMerchArService.getClubMerchandise(clubId);
      if (data.length > 0) {
        setMerchList(data);
        setSelectedMerch(data[0]);
      } else {
        const fallback: ClubMerchandise = {
          id: "demo-hoodie",
          club_id: clubId,
          name: `${clubName} Official Heavyweight Hoodie`,
          item_type: "hoodie",
          price_cents: 4500,
          transparent_logo_url: "https://placehold.co/400x400/transparent/white.png?text=LOGO",
          ar_scale_factor: 1.0,
          ar_offset_y_percent: 0.1,
          is_preorder_active: true,
        };
        setMerchList([fallback]);
        setSelectedMerch(fallback);
      }
      setLoading(false);
    };

    loadMerch();
  }, [clubId, clubName, initialMerch]);

  // Load logo image when selected merch changes
  useEffect(() => {
    if (selectedMerch?.transparent_logo_url) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = selectedMerch.transparent_logo_url;
      img.onload = () => {
        logoImageRef.current = img;
      };
    }
  }, [selectedMerch]);

  const startCamera = async () => {
    try {
      setSnapshotTaken(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        startArTrackingLoop();
      }
    } catch (err) {
      console.error(err);
      toast.error("Unable to access camera. Please allow camera permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startArTrackingLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        // Draw camera frame (mirrored for natural selfie feel)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();

        // Estimated head/torso tracking based on center portrait framing
        const estimatedFaceBox = {
          x: canvas.width * 0.35,
          y: canvas.height * 0.15,
          width: canvas.width * 0.3,
          height: canvas.height * 0.3,
        };

        const chest: ChestCoordinates = calculateChestPlacement(
          estimatedFaceBox,
          canvas.width,
          canvas.height,
          selectedMerch?.ar_scale_factor || 1.0,
          selectedMerch?.ar_offset_y_percent || 0.0,
        );

        // Draw AR Hoodie/T-Shirt Graphic overlay
        if (logoImageRef.current) {
          ctx.save();
          // Subtle glow behind logo
          ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
          ctx.shadowBlur = 10;
          ctx.drawImage(logoImageRef.current, chest.x, chest.y, chest.width, chest.height);
          ctx.restore();
        } else {
          // Fallback AR stamp placeholder
          ctx.fillStyle = "rgba(59, 130, 246, 0.85)";
          ctx.beginPath();
          ctx.roundRect(chest.x, chest.y, chest.width, chest.height, 12);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 16px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(clubName, chest.x + chest.width / 2, chest.y + chest.height / 2);
        }

        // Draw subtle AR tracking indicator
        ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(chest.x - 4, chest.y - 4, chest.width + 8, chest.height + 8);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
  };

  const handleTakeSnapshot = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    setSnapshotTaken(dataUrl);
    stopCamera();

    if (selectedMerch) {
      await clubMerchArService.recordSnapshot(selectedMerch.id, dataUrl);
    }
    toast.success("Snapshot captured! Look at that drip! 🔥");
  };

  const handleDownloadSnapshot = () => {
    if (!snapshotTaken) return;
    const a = document.createElement("a");
    a.href = snapshotTaken;
    a.download = `${clubName.replace(/\s+/g, "_")}_Merch_TryOn.png`;
    a.click();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-card text-card-foreground border rounded-xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold tracking-tight">Club Merch "Try-On" AR Experience</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Virtually preview {clubName} apparel on your live camera before pre-ordering.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!cameraActive && !snapshotTaken ? (
            <button
              onClick={startCamera}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Camera className="w-4 h-4" />
              Launch AR Camera
            </button>
          ) : cameraActive ? (
            <button
              onClick={stopCamera}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              <CameraOff className="w-4 h-4" />
              Stop Camera
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Merch Selector list */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            Available Pre-Order Merch ({merchList.length})
          </h3>
          <div className="space-y-3">
            {merchList.map((item) => {
              const isSelected = selectedMerch?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedMerch(item)}
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : "hover:border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm capitalize flex items-center gap-1.5">
                      <Shirt className="w-4 h-4 text-primary" />
                      {item.name}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      ${(item.price_cents / 100).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                    Type: {item.item_type}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live AR Camera Viewport */}
        <div className="lg:col-span-2 border rounded-xl overflow-hidden bg-zinc-950 flex flex-col items-center justify-center min-h-[420px] relative">
          <video ref={videoRef} className="hidden" playsInline muted />

          {cameraActive ? (
            <>
              <canvas ref={canvasRef} className="w-full max-h-[480px] object-cover" />
              <div className="absolute bottom-4 flex items-center gap-3">
                <button
                  onClick={handleTakeSnapshot}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:scale-105 transition-transform shadow-lg"
                >
                  <Camera className="w-4 h-4" />
                  Take Snapshot
                </button>
              </div>
            </>
          ) : snapshotTaken ? (
            <div className="w-full flex flex-col items-center p-4 space-y-4">
              <img
                src={snapshotTaken}
                alt="AR Try-on Snapshot"
                className="max-h-[380px] rounded-lg shadow-md border"
              />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={startCamera}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retake
                </button>
                <button
                  onClick={handleDownloadSnapshot}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  {saved ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                  {saved ? "Saved!" : "Save & Share"}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                <Camera className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-zinc-200 text-sm">AR Fitting Room Ready</h4>
              <p className="text-xs text-zinc-400 max-w-sm">
                Click "Launch AR Camera" to project the {selectedMerch?.name || "club merch"} logo
                onto your camera feed in real-time.
              </p>
              <button
                onClick={startCamera}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Camera className="w-3.5 h-3.5" />
                Launch Camera
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
