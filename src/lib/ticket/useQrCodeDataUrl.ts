import { useCallback, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

/**
 * Provides a data URL (PNG) for a QR code so it can be embedded into the
 * PDF ticket (issue #1913).
 *
 * `QRCodeCanvas` forwards a ref to the underlying <canvas> element, so we
 * render it invisibly and read `canvas.toDataURL()` once it has painted.
 * The value is cached per `text` and reset to null whenever the input
 * changes (the canvas is re-rendered and re-read).
 */
export function useQrCodeDataUrl(text: string | null | undefined): {
  qrCodeDataUrl: string | null;
  qrCanvasRef: (node: HTMLCanvasElement | null) => void;
} {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  const qrCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (!text) {
        setQrCodeDataUrl(null);
        return;
      }
      if (node) {
        // requestAnimationFrame lets React's commit flush so the canvas is
        // actually painted before we snapshot it.
        requestAnimationFrame(() => {
          try {
            setQrCodeDataUrl(node.toDataURL("image/png"));
          } catch {
            setQrCodeDataUrl(null);
          }
        });
      }
    },
    [text],
  );

  return { qrCodeDataUrl, qrCanvasRef };
}
