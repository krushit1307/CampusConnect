// =============================================================================
// Component: QRScanner
// Issue: #2732 - Implement 'Scan to Check-in' Kiosk Mode for Tablets
// Description: Wraps the html5-qrcode library to provide a continuous,
// front-facing camera scanning loop. Handles camera initialization errors
// and provides visual feedback for the scanning area.
// =============================================================================

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  isActive: boolean;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, isActive }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (!isActive) return;

    const initializeScanner = async () => {
      setIsInitializing(true);
      setError(null);

      try {
        // Create scanner instance
        // We set a specific format to optimize for QR codes
        scannerRef.current = new Html5Qrcode("kiosk-scanner-reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });

        // Configuration for high-performance continuous scanning
        const config = {
          fps: 15, // High FPS for instant detection
          qrbox: (width: number, height: number) => {
            // Square scanning area in the center
            const minEdge = Math.min(width, height);
            return {
              width: minEdge * 0.7,
              height: minEdge * 0.7,
            };
          },
          aspectRatio: 1.0,
          // Force front-facing camera for tablets/iPads on stands
          facingMode: "user",
        };

        // Start scanning
        await scannerRef.current.start(
          { facingMode: "user" },
          config,
          (decodedText) => {
            // Successfully scanned
            onScanSuccess(decodedText);
          },
          (errorMessage) => {
            // Scan failure (normal when no QR is in frame)
            // We ignore these to prevent console spam
          },
        );

        setIsInitializing(false);
      } catch (err: any) {
        console.error("[QRScanner] Initialization failed:", err);
        setError(err.message || "Failed to access camera. Please check permissions.");
        setIsInitializing(false);
      }
    };

    initializeScanner();

    // Cleanup on unmount or when isActive becomes false
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
          })
          .catch((err) => {
            console.error("[QRScanner] Cleanup error:", err);
          });
      }
    };
  }, [isActive, onScanSuccess]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      {/* Scanner Container */}
      <div
        id="kiosk-scanner-reader"
        ref={containerRef}
        className="w-full h-full max-w-2xl max-h-2xl"
      />

      {/* Scanning Overlay UI */}
      {!error && !isInitializing && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Corner Brackets */}
          <div className="w-64 h-64 relative">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg"></div>

            {/* Scanning Line Animation */}
            <div className="absolute inset-x-0 top-0 h-1 bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)] animate-scan-line"></div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isInitializing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/80">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mb-6"></div>
          <p className="text-2xl font-bold">Initializing Camera...</p>
          <p className="text-gray-400 mt-2">Please allow camera access when prompted.</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-red-900/90 p-8 text-center">
          <svg className="w-24 h-24 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-3xl font-bold mb-4">Camera Error</h3>
          <p className="text-xl text-red-200 max-w-md">{error}</p>
          <p className="text-lg text-red-300 mt-6">
            Please refresh the page and ensure camera permissions are granted.
          </p>
        </div>
      )}

      {/* Custom CSS for the scanning line animation */}
      <style>{`
        @keyframes scan-line {
          0% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(250px); opacity: 0.5; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-scan-line {
          animation: scan-line 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};
