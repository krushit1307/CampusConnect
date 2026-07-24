import { useState } from "react";
import { AlertCircle, CheckCircle2, QrCode, ShieldAlert, ShieldCheck, Upload } from "lucide-react";

import {
  extractLSBData,
  TicketPayload,
  VerificationResult,
  verifyTicketPayload,
} from "@/lib/steganography";

export function SteganographicQRScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [extractedPayload, setExtractedPayload] = useState<TicketPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setErrorMessage(null);
    setVerificationResult(null);
    setExtractedPayload(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          setErrorMessage("Failed to create canvas context");
          setIsScanning(false);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const rawExtracted = extractLSBData(imageData);

        if (!rawExtracted) {
          setErrorMessage(
            "No hidden LSB signature detected. Ticket may be an unauthenticated screenshot or plain QR code.",
          );
          setIsScanning(false);
          return;
        }

        try {
          const payload: TicketPayload = JSON.parse(rawExtracted);
          setExtractedPayload(payload);
          const result = await verifyTicketPayload(payload);
          setVerificationResult(result);
        } catch {
          setErrorMessage("Corrupted steganography signature payload.");
        } finally {
          setIsScanning(false);
        }
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full space-y-4 rounded-xl border-2 border-black bg-cream p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center gap-2 border-b border-black/20 pb-3">
        <QrCode className="h-5 w-5 text-black" />
        <h3 className="text-lg font-black tracking-tight">Steganographic Ticket Scanner</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Upload a ticket image to extract and verify the hidden LSB Ed25519 cryptographic signature.
      </p>

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
