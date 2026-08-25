import React, { useState, useRef, useEffect, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { createClient } from "@/lib/supabase/client";
import { playSuccessBeep } from "@/lib/audio/beep";
import { Button } from "@/components/ui/button";
import { Loader2, ClipboardList } from "lucide-react";

// 🔥 Added CustomQuestion interface
export interface CustomQuestion {
  id: string;
  prompt: string;
}

interface LeadScannerProps {
  eventId: string;
  sponsorId: string;
  customQuestions?: CustomQuestion[]; // Added to accept dynamic questions
  onLeadCaptured?: (lead: any) => void;
}

// 🛠️ MOCK DATA: So you can test the UI without needing the Sponsor Dashboard built yet
const MOCK_CUSTOM_QUESTIONS: CustomQuestion[] = [
  { id: "q1", prompt: "Do you require US work sponsorship?" },
  { id: "q2", prompt: "Are you looking for a summer internship?" },
];

export const LeadScanner: React.FC<LeadScannerProps> = ({
  eventId,
  sponsorId,
  customQuestions = MOCK_CUSTOM_QUESTIONS, // Defaults to our mock questions for testing
  onLeadCaptured,
}) => {
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

  // 🔥 INTERCEPTOR STATE 🔥
  const [pendingScanText, setPendingScanText] = useState<string | null>(null);
  const [customAnswers, setCustomAnswers] = useState<Record<string, boolean | null>>({});

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

  // The actual database submission logic extracted so we can call it after the questions
  const processLeadToDatabase = async (
    ticketId: string,
    answersData: Record<string, boolean | null>,
  ) => {
    setIsProcessing(true);
    setPendingScanText(null); // Close the modal

    try {
      // 📝 PAYLOAD AUGMENTATION: Format the answers nicely to append to the notes/payload
      const formattedAnswers = Object.entries(answersData)
        .map(([qId, ans]) => {
          const qText = customQuestions.find((q) => q.id === qId)?.prompt;
          return `- ${qText}: ${ans ? "YES" : "NO"}`;
        })
        .join("\n");

      const finalNotesPayload = formattedAnswers
        ? `[Custom Question Answers]\n${formattedAnswers}\n\n[General Notes]\n${notes}`
        : notes;

      const { data, error } = await supabase.rpc("scan_sponsor_lead", {
        p_ticket_id: ticketId,
        p_sponsor_id: sponsorId,
        p_event_id: eventId,
        p_notes: finalNotesPayload,
      });

      if (error) throw error;

      setScanResult(data);
      if (data.success && onLeadCaptured) {
        onLeadCaptured(data);
      }
    } catch (err: any) {
      console.error("Lead scan error:", err);
      setScanResult({
        success: false,
        message: err.message || "Failed to process lead scan.",
      });
    } finally {
      setIsProcessing(false);
      setCustomAnswers({}); // Reset answers
    }
  };

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
          playSuccessBeep();

          // 🔥 INTERCEPT LOGIC 🔥
          if (customQuestions && customQuestions.length > 0) {
            // Setup blank answers and open modal
            const initialAnswers: Record<string, null> = {};
            customQuestions.forEach((q) => (initialAnswers[q.id] = null));
            setCustomAnswers(initialAnswers);
            setPendingScanText(decodedText);
          } else {
            // No custom questions configured, process normally
            processLeadToDatabase(decodedText, {});
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
  }, [cameraId, eventId, sponsorId, notes, supabase, onLeadCaptured, customQuestions]);

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
    <div className="flex flex-col items-center w-full max-w-md mx-auto p-4 space-y-4 font-sans">
      <div className="w-full text-center mb-2">
        <h2 className="text-xl font-bold">Booth Lead Scanner</h2>
        <p className="text-sm text-gray-500">Scan attendee tickets to capture leads.</p>
      </div>

      <div
        ref={scannerContainerRef}
        id="sponsor-lead-scanner"
        className="w-full aspect-square bg-black rounded-xl overflow-hidden relative shadow-lg"
      >
        {!isScanning && !scanResult && !pendingScanText && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <Button onClick={startScanning} size="lg">
              Start Camera
            </Button>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20 text-white backdrop-blur-sm">
            <Loader2 className="w-12 h-12 animate-spin mb-4 text-blue-500" />
            <p className="font-bold tracking-wide">Syncing to CRM...</p>
          </div>
        )}

        {/* 🔥 CUSTOM QUESTIONS INTERCEPT MODAL 🔥 */}
        {pendingScanText && !isProcessing && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-white text-black p-5 rounded-2xl w-full space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-2 border-b pb-3">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm uppercase">Sponsor Interview</h3>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-gray-500 font-medium">
                  Please ask the student the following required questions:
                </p>

                {customQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-100"
                  >
                    <p className="text-sm font-bold leading-snug">{q.prompt}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={customAnswers[q.id] === true ? "default" : "outline"}
                        className={
                          customAnswers[q.id] === true
                            ? "bg-green-600 hover:bg-green-700 w-full"
                            : "w-full"
                        }
                        onClick={() => setCustomAnswers((prev) => ({ ...prev, [q.id]: true }))}
                      >
                        Yes
                      </Button>
                      <Button
                        size="sm"
                        variant={customAnswers[q.id] === false ? "default" : "outline"}
                        className={
                          customAnswers[q.id] === false
                            ? "bg-red-600 hover:bg-red-700 w-full"
                            : "w-full"
                        }
                        onClick={() => setCustomAnswers((prev) => ({ ...prev, [q.id]: false }))}
                      >
                        No
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Button
                  className="w-full font-bold bg-blue-600 hover:bg-blue-700"
                  disabled={Object.values(customAnswers).some((ans) => ans === null)}
                  onClick={() => processLeadToDatabase(pendingScanText, customAnswers)}
                >
                  Save & Capture Lead
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isScanning && !scanResult && !isProcessing && !pendingScanText && (
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
