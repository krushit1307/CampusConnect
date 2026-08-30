import React, { useState, useRef, useEffect, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { createClient } from "@/lib/supabase/client";
import { playSuccessBeep } from "@/lib/audio/beep";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface LeadScannerProps {
  eventId: string;
  sponsorId: string;
  onLeadCaptured?: (lead: any) => void;
}

export const LeadScanner: React.FC<LeadScannerProps> = ({ eventId, sponsorId, onLeadCaptured }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraId, setCameraId] = useState<string>("");
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    attendeeName?: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const initializeCameras = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          const rearCameras = devices.filter(
            (device) =>
              device.label.toLowerCase().includes("back") ||
              device.label.toLowerCase().includes("rear") ||
              device.label.toLowerCase().includes("environment"),
          );
          const camerasToUse = rearCameras.length > 0 ? rearCameras : devices;
          setAvailableCameras(camerasToUse);
          setCameraId(camerasToUse[0].id);
        }
      } catch (err) {
        console.error("Error fetching cameras:", err);
        alert("Camera access is required for QR scanning.");
      }
    };
    initializeCameras();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const startScanning = useCallback(async () => {
    if (!scannerContainerRef.current || !cameraId) return;

    try {
      scannerRef.current = new Html5Qrcode("sponsor-lead-scanner");
      await scannerRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          if (scannerRef.current) {
            await scannerRef.current.pause();
          }
          setIsProcessing(true);
          playSuccessBeep();

          try {
            const { data, error } = await supabase.rpc("scan_sponsor_lead", {
              p_ticket_id: decodedText,
              p_sponsor_id: sponsorId,
              p_event_id: eventId,
              p_notes: notes,
            });

            if (error) throw error;

            setScanResult(data);
            if (data.success) {
              if (onLeadCaptured) {
                onLeadCaptured(data);
              }
              // Asynchronously dispatch webhook
              if (data.lead_id) {
                supabase.functions
                  .invoke("dispatch-sponsor-webhook", {
                    body: { lead_id: data.lead_id },
                  })
                  .catch((err) => console.error("Webhook dispatch error:", err));
              }
            }
          } catch (err: any) {
            console.error("Lead scan error:", err);
            setScanResult({
              success: false,
              message: err.message || "Failed to process lead scan.",
            });
          } finally {
            setIsProcessing(false);
          }
        },
        () => {
          // Ignore normal scan failures
        },
      );
      setIsScanning(true);
    } catch (err) {
      console.error("Failed to start scanner:", err);
      alert("Failed to start camera. Please check permissions.");
    }
  }, [cameraId, eventId, sponsorId, notes, supabase, onLeadCaptured]);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current && isScanning) {
      await scannerRef.current.stop();
      setIsScanning(false);
    }
  }, [isScanning]);

  const switchCamera = useCallback(async () => {
    if (availableCameras.length <= 1) return;

    const currentIndex = availableCameras.findIndex((cam) => cam.id === cameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;

    setCameraId(availableCameras[nextIndex].id);
    if (isScanning) {
      await stopScanning();
      setTimeout(() => startScanning(), 500);
    }
  }, [availableCameras, cameraId, isScanning, startScanning, stopScanning]);

  const resetScanner = useCallback(async () => {
    setScanResult(null);
    setNotes("");
    if (scannerRef.current) {
      await scannerRef.current.resume();
    }
  }, []);

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto p-4 space-y-4">
      <div className="w-full text-center mb-2">
        <h2 className="text-xl font-bold">Booth Lead Scanner</h2>
        <p className="text-sm text-gray-500">Scan attendee tickets to capture leads.</p>
      </div>

      <div
        ref={scannerContainerRef}
        id="sponsor-lead-scanner"
        className="w-full aspect-square bg-black rounded-xl overflow-hidden relative shadow-lg"
      >
        {!isScanning && !scanResult && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <Button onClick={startScanning} size="lg">
              Start Camera
            </Button>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10 text-white">
            <Loader2 className="w-12 h-12 animate-spin mb-4" />
            <p>Processing Lead...</p>
          </div>
        )}
      </div>

      {isScanning && !scanResult && !isProcessing && (
        <div className="w-full space-y-3">
          <textarea
            className="w-full p-2 border rounded-md text-sm"
            placeholder="Add optional notes for the next scan..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={switchCamera}
              disabled={availableCameras.length <= 1}
              className="flex-1"
            >
              Switch Camera
            </Button>
            <Button variant="destructive" onClick={stopScanning} className="flex-1">
              Stop
            </Button>
          </div>
        </div>
      )}

      {scanResult && (
        <div
          className={`w-full p-6 rounded-xl border ${scanResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
        >
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="text-4xl mb-2">{scanResult.success ? "✅" : "❌"}</div>
            <h3
              className={`font-bold text-lg ${scanResult.success ? "text-green-800" : "text-red-800"}`}
            >
              {scanResult.success ? "Lead Captured!" : "Scan Failed"}
            </h3>
            <p className="text-sm text-gray-600">{scanResult.message}</p>
            {scanResult.attendeeName && (
              <p className="font-medium mt-2">Attendee: {scanResult.attendeeName}</p>
            )}
            <Button
              onClick={resetScanner}
              className="mt-4 w-full"
              variant={scanResult.success ? "default" : "secondary"}
            >
              Scan Next Attendee
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadScanner;
