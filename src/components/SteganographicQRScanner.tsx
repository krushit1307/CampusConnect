import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  QrCode,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from "lucide-react";

import {
  extractLSBData,
  TicketPayload,
  VerificationResult,
  verifyTicketPayload,
} from "@/lib/steganography";

interface SteganographicQRScannerProps {
  onVerificationSuccess?: (payload: TicketPayload, result: VerificationResult) => void;
  onVerificationError?: (message: string) => void;
}

export function SteganographicQRScanner({
  onVerificationSuccess,
  onVerificationError,
}: SteganographicQRScannerProps) {
  const [mode, setMode] = useState<"camera" | "upload">("camera");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [extractedPayload, setExtractedPayload] = useState<TicketPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimeoutRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const suppressScanningRef = useRef(false);

  const stopCamera = () => {
    if (scanTimeoutRef.current) {
      window.clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    suppressScanningRef.current = false;
    setCameraReady(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const finalizeVerification = async (payload: TicketPayload) => {
    setExtractedPayload(payload);
    const result = await verifyTicketPayload(payload);
    setVerificationResult(result);

    if (result.valid) {
      suppressScanningRef.current = true;
      onVerificationSuccess?.(payload, result);
      stopCamera();
      setMode("camera");
      return;
    }

    const reason = result.reason ?? "Ticket signature verification failed.";
    setErrorMessage(reason);
    onVerificationError?.(reason);
  };

  const processImageData = async (source: ImageData) => {
    if (processingRef.current || suppressScanningRef.current) return;

    processingRef.current = true;
    setIsScanning(true);
    setErrorMessage(null);
    setVerificationResult(null);
    setExtractedPayload(null);

    try {
      const rawExtracted = extractLSBData(source);

      if (!rawExtracted) {
        const reason =
          "No hidden LSB signature detected. Ticket may be an unauthenticated screenshot or plain QR code.";
        setErrorMessage(reason);
        onVerificationError?.(reason);
        return;
      }

      const payload = JSON.parse(rawExtracted) as TicketPayload;
      await finalizeVerification(payload);
    } catch {
      const reason = "Corrupted steganography signature payload.";
      setErrorMessage(reason);
      onVerificationError?.(reason);
    } finally {
      setIsScanning(false);
      processingRef.current = false;
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    stopCamera();
    setMode("upload");

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          const reason = "Failed to create canvas context";
          setErrorMessage(reason);
          onVerificationError?.(reason);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        await processImageData(imageData);
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const reason = "This browser does not support camera access.";
      setErrorMessage(reason);
      onVerificationError?.(reason);
      return;
    }

    stopCamera();
    setMode("camera");
    setErrorMessage(null);
    setVerificationResult(null);
    setExtractedPayload(null);

    try {
      suppressScanningRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }

      const scanFrame = () => {
        if (!streamRef.current || !videoRef.current || suppressScanningRef.current) {
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth || 320;
        canvas.height = videoRef.current.videoHeight || 240;
        const ctx = canvas.getContext("2d");

        if (!ctx || videoRef.current.readyState < 2) {
          scanTimeoutRef.current = window.setTimeout(scanFrame, 1200);
          return;
        }

        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        void processImageData(imageData).finally(() => {
          if (streamRef.current) {
            scanTimeoutRef.current = window.setTimeout(scanFrame, 1400);
          }
        });
      };

      scanFrame();
    } catch {
      const reason = "Unable to access the camera. Please use upload mode instead.";
      setErrorMessage(reason);
      onVerificationError?.(reason);
      stopCamera();
    }
  };

  return (
    <div className="w-full space-y-4 rounded-xl border-2 border-black bg-cream p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center gap-2 border-b border-black/20 pb-3">
        <QrCode className="h-5 w-5 text-black" />
        <h3 className="text-lg font-black tracking-tight">Steganographic Ticket Scanner</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Scan a signed ticket from the camera or upload a saved PNG to verify the embedded LSB
        signature and mark the attendee as checked in.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void startCamera();
          }}
          className={`rounded-full border-2 border-black px-3 py-2 text-[11px] font-black uppercase tracking-wide transition ${
            mode === "camera" ? "bg-black text-white" : "bg-white text-black"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" /> Camera Scan
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            setMode("upload");
          }}
          className={`rounded-full border-2 border-black px-3 py-2 text-[11px] font-black uppercase tracking-wide transition ${
            mode === "upload" ? "bg-black text-white" : "bg-white text-black"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Upload Ticket
          </span>
        </button>
      </div>

      {mode === "camera" ? (
        <div className="space-y-3 rounded-lg border-2 border-dashed border-black/40 bg-white p-3">
          <div className="overflow-hidden rounded-lg border-2 border-black bg-black">
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void startCamera();
              }}
              className="neu-border neu-press bg-lime px-3 py-2 text-[11px] font-black uppercase tracking-wider text-black"
            >
              <span className="flex items-center gap-1.5">
                <ScanLine className="h-3.5 w-3.5" /> Start Camera Scan
              </span>
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="neu-border bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wider text-black"
            >
              Stop Camera
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {cameraReady
              ? "Camera is live. Place the ticket in front of the camera to verify it automatically."
              : "Start the camera to begin scanning the attendee ticket."}
          </p>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-black/40 bg-white p-6 text-center transition-colors hover:border-black">
          <Upload className="h-7 w-7 text-muted-foreground" />
          <span className="text-sm font-bold">Choose Ticket PNG Image</span>
          <span className="text-[11px] text-muted-foreground">
            Verifies LSB embedded timestamp & signature
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      )}

      {isScanning && (
        <div className="flex items-center justify-center gap-2 py-3 text-xs font-bold">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
          <span>Decoding LSB Steganography...</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-lg border-2 border-red-600 bg-red-50 p-3 text-xs font-semibold text-red-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="font-bold">Verification Failed</p>
            <p className="mt-0.5 text-[11px]">{errorMessage}</p>
          </div>
        </div>
      )}

      {verificationResult && (
        <div
          className={`flex flex-col gap-2.5 rounded-lg border-2 p-4 text-xs font-semibold ${
            verificationResult.valid
              ? "border-emerald-700 bg-emerald-50 text-emerald-950"
              : "border-amber-700 bg-amber-50 text-amber-950"
          }`}
        >
          <div className="flex items-center gap-2">
            {verificationResult.valid ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600" />
            )}
            <span className="text-sm font-black uppercase">
              {verificationResult.valid
                ? "Authentic Ticket Verified ✓"
                : "Invalid Ticket Signature ✗"}
            </span>
          </div>

          {verificationResult.valid ? (
            <div className="space-y-1 font-mono text-[11px]">
              <p>
                <span className="font-bold">RSVP ID:</span> {verificationResult.rsvpId}
              </p>
              <p>
                <span className="font-bold">Issued At:</span>{" "}
                {verificationResult.timestamp
                  ? new Date(verificationResult.timestamp).toLocaleString()
                  : "N/A"}
              </p>
              <p className="flex items-center gap-1 font-sans text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> LSB Cryptographic Ed25519 signature is
                authentic and untampered.
              </p>
            </div>
          ) : (
            <p className="text-[11px]">{verificationResult.reason}</p>
          )}

          {extractedPayload && (
            <details className="mt-1 cursor-pointer font-mono text-[10px] opacity-80">
              <summary className="font-bold">View Raw Extracted LSB Payload</summary>
              <pre className="mt-1 overflow-x-auto rounded bg-black/10 p-2">
                {JSON.stringify(extractedPayload, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
