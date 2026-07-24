import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

import { embedLSBData, signTicketPayload, TicketPayload } from "@/lib/steganography";

interface SteganographicQRCodeProps {
  rsvpId: string;
  size?: number;
  onPayloadGenerated?: (payload: TicketPayload) => void;
}

export function SteganographicQRCode({
  rsvpId,
  size = 220,
  onPayloadGenerated,
}: SteganographicQRCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [signedPayload, setSignedPayload] = useState<TicketPayload | null>(null);
  const [isSigned, setIsSigned] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function generateAndEmbedSignature() {
      const payload = await signTicketPayload(rsvpId);
      if (!isMounted) return;

      setSignedPayload(payload);
      if (onPayloadGenerated) {
        onPayloadGenerated(payload);
      }

      // Convert SVG to Canvas and embed LSB Steganography
      setTimeout(() => {
        if (!containerRef.current || !canvasRef.current) return;
        const svgElement = containerRef.current.querySelector("svg");
        if (!svgElement) return;

        const svgData = new XMLSerializer().serializeToString(svgElement);
        const img = new Image();

        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);

          // Get image pixel data and embed cryptographic LSB payload
          const imageData = ctx.getImageData(0, 0, size, size);
          const payloadString = JSON.stringify(payload);
          const stegoImageData = embedLSBData(imageData, payloadString);

          ctx.putImageData(stegoImageData as ImageData, 0, 0);
          if (isMounted) setIsSigned(true);
        };

        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
      }, 100);
    }

    generateAndEmbedSignature();

    return () => {
      isMounted = false;
    };
  }, [rsvpId, size, onPayloadGenerated]);

  const handleDownloadPNG = () => {
    if (!canvasRef.current) return;
    const pngUrl = canvasRef.current.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.download = `StegoTicket-${rsvpId.slice(-6).toUpperCase()}.png`;
    downloadLink.href = pngUrl;
    downloadLink.click();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Hidden SVG element used as QR generator input */}
      <div ref={containerRef} className="hidden">
        <QRCodeSVG value={rsvpId} size={size} level="H" />
      </div>

      <div className="relative rounded-xl border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <canvas ref={canvasRef} width={size} height={size} className="block rounded-md" />
        {isSigned && (
          <div className="absolute -top-2 -right-2 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            <ShieldCheck className="h-3 w-3" /> LSB Signed
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        <span>Hidden LSB Signature Active</span>
        {isSigned && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
      </div>

      <button
        onClick={handleDownloadPNG}
        className="neu-border neu-press mt-1 w-full bg-black px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-cream transition-transform"
      >
        Download Authentic Ticket (PNG)
      </button>

      {signedPayload && (
        <div className="mt-1 w-full rounded border bg-muted/50 p-2 text-left font-mono text-[10px] text-muted-foreground">
          <p className="font-bold text-foreground">Cryptographic Verification Meta:</p>
          <p className="truncate">
            Timestamp: {new Date(signedPayload.timestamp).toLocaleString()}
          </p>
          <p className="truncate">Sig: {signedPayload.signature.slice(0, 16)}...</p>
        </div>
      )}
    </div>
  );
}
