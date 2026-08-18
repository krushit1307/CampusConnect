import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Compass from "lucide-react/dist/esm/icons/compass";
import QrCode from "lucide-react/dist/esm/icons/qr-code";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Trophy from "lucide-react/dist/esm/icons/trophy";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";

export default function ScavengerHuntGame() {
  const { id: huntId } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();

  const [qrInput, setQrInput] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  // 1. Fetch Hunt details
  const { data: hunt, isLoading: isHuntLoading } = useQuery({
    queryKey: ["scavenger_hunt_detail", huntId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scavenger_hunts")
        .select("id, title, description")
        .eq("id", huntId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!huntId,
  });

  // 2. Fetch User progress details via RPC
  const { data: progress, isLoading: isProgressLoading, refetch: refetchProgress } = useQuery({
    queryKey: ["scavenger_hunt_progress", huntId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_scavenger_hunt_progress", {
        p_hunt_id: huntId!,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!huntId,
  });

  // Trigger confetti explosion dynamically loading script
  const triggerConfetti = () => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
    script.onload = () => {
      try {
        (window as any).confetti({
          particleCount: 200,
          spread: 90,
          origin: { y: 0.6 },
        });
      } catch (e) {
        console.error("Confetti script failed to fire: ", e);
      }
    };
    document.body.appendChild(script);
  };

  // Submit scan mutation
  const submitScanMutation = useMutation({
    mutationFn: async (qrHash: string) => {
      const { data, error } = await supabase.rpc("submit_waypoint_scan", {
        p_hunt_id: huntId!,
        p_qr_hash: qrHash.trim(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        setQrInput("");
        setShowScanner(false);
        if (data.is_final) {
          triggerConfetti();
        }
        refetchProgress();
      } else {
        toast.error(data.message);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit waypoint scan");
    },
  });

  const isLoading = isHuntLoading || isProgressLoading;

  return (
    <SiteShell>
      <div className="min-h-screen bg-cream px-4 py-12 md:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-8 text-black">
          {/* Back Button */}
          <Link
            to="/scavenger-hunts"
            className="flex items-center gap-2 font-mono text-sm font-bold uppercase hover:underline mb-4"
          >
            <ArrowLeft size={16} /> Back to Scavenger Hunts
          </Link>

          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
            </div>
          ) : hunt && progress ? (
            <div className="space-y-6">
              {/* Info Card */}
              <div className="neu-border bg-[#FDF2F8] p-6 shadow-[4px_4px_0_0_#000]">
                <h1 className="font-display text-3xl font-black uppercase tracking-tight">
                  {hunt.title}
                </h1>
                <p className="mt-2 font-mono text-xs text-black/60">
                  {hunt.description}
                </p>

                {/* Progress Indicators */}
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="border-2 border-black bg-white p-3 font-mono">
                    <p className="text-[10px] font-bold uppercase text-black/50">Unlocked Waypoints</p>
                    <p className="text-2xl font-black mt-1">
                      {progress.completed_steps} <span className="text-sm font-normal">/ {progress.total_steps}</span>
                    </p>
                  </div>
                  <div className="border-2 border-black bg-white p-3 font-mono">
                    <p className="text-[10px] font-bold uppercase text-black/50">Completion Award</p>
                    <p className="text-2xl font-black mt-1 text-yellow-600 flex items-center gap-1.5">
                      <Trophy className="h-6 w-6" /> 1000 Pts
                    </p>
                  </div>
                </div>
              </div>

              {/* Status & Clue Block */}
              {progress.is_completed ? (
                <div className="neu-border bg-green-50 border-2 border-green-500 p-8 text-center shadow-[4px_4px_0_0_#000] space-y-4">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                  <h2 className="font-display text-2xl font-black uppercase text-green-900">
                    Challenge Completed!
                  </h2>
                  <p className="font-mono text-sm text-green-700 max-w-sm mx-auto">
                    Excellent work! You have successfully scanned all waypoints and unlocked 1,000 Gamification Points. Check your user ledger!
                  </p>
                </div>
              ) : (
                <div className="neu-border bg-white p-6 shadow-[4px_4px_0_0_#000] space-y-6">
                  {/* Current Active Waypoint Target Clue */}
                  <div className="space-y-2 border-b-2 border-black pb-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-red-500" />
                      <h3 className="font-display text-lg font-black uppercase">
                        Current Clue: Waypoint #{progress.completed_steps + 1}
                      </h3>
                    </div>
                    <p className="font-mono text-sm bg-gray-50 border-2 border-black p-4 text-gray-800 rounded-none shadow-[2px_2px_0_0_#000]">
                      {progress.next_clue || "No clues available."}
                    </p>
                  </div>

                  {/* QR Scan submission panel */}
                  <div className="space-y-4">
                    <h4 className="font-mono text-xs font-bold uppercase">
                      Scan Waypoint QR Code
                    </h4>
                    <p className="font-mono text-xs text-gray-500">
                      Found the waypoint? Scan the physical QR code or enter the secret location hash below.
                    </p>

                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter secret QR Code hash"
                          value={qrInput}
                          onChange={(e) => setQrInput(e.target.value)}
                          className="w-full border-2 border-black p-2.5 font-mono text-xs focus:outline-none focus:bg-yellow-50"
                        />
                        <button
                          onClick={() => submitScanMutation.mutate(qrInput)}
                          disabled={submitScanMutation.isPending || !qrInput.trim()}
                          className="neu-border bg-black text-white px-4 py-2 font-mono text-xs font-bold uppercase whitespace-nowrap"
                        >
                          Verify
                        </button>
                      </div>
                      <span className="text-center font-mono text-[10px] text-gray-400">
                        - OR -
                      </span>
                      <button
                        onClick={() => setShowScanner(!showScanner)}
                        className="neu-border neu-press bg-yellow-200 text-black p-2.5 font-mono text-xs font-bold uppercase flex items-center justify-center gap-2"
                      >
                        <QrCode size={16} /> {showScanner ? "Close Camera Scanner" : "Simulate Camera Scanner"}
                      </button>

                      {showScanner && (
                        <div className="border-2 border-black p-6 bg-gray-50 text-center font-mono space-y-4">
                          <p className="text-xs font-bold text-gray-600">Simulating QR Scanner...</p>
                          <div className="mx-auto w-32 h-32 border-4 border-dashed border-black/40 flex items-center justify-center animate-pulse bg-white">
                            <QrCode size={48} className="text-black/30" />
                          </div>
                          <p className="text-[10px] text-gray-400">
                            Camera permissions checked. Use input above to paste waypoint hashes directly.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="neu-border bg-white p-8 text-center shadow-[4px_4px_0_0_#000]">
              <p className="font-mono text-sm text-black/55 italic">
                Hunt not found.
              </p>
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
