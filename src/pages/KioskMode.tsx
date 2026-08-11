// =============================================================================
// Page: KioskMode
// Issue: #2732 - Implement 'Scan to Check-in' Kiosk Mode for Tablets
// Description: A specialized, full-screen, self-service terminal for event
// check-ins. Hides all navigation, prevents sleep via Wake Lock, and provides
// massive automated visual feedback for successful/failed scans.
// Route: /kiosk/:eventId
// =============================================================================

import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { QRScanner } from "../components/kiosk/QRScanner";
import { useKioskMode } from "../hooks/useKioskMode";
import { useWakeLock } from "../hooks/useWakeLock";

export const KioskMode: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();

  const { isFullscreen, enterFullscreen, status, result, processScan, incrementExitGesture } =
    useKioskMode(eventId || "");

  const {
    isSupported: isWakeLockSupported,
    isActive: isWakeLockActive,
    requestWakeLock,
  } = useWakeLock();

  // Auto-request Wake Lock on mount
  useEffect(() => {
    if (isWakeLockSupported && !isWakeLockActive) {
      requestWakeLock();
    }
  }, [isWakeLockSupported, isWakeLockActive, requestWakeLock]);

  const handleScan = (decodedText: string) => {
    if (status === "scanning") {
      processScan(decodedText);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900 text-white flex flex-col overflow-hidden select-none"
      onClick={(e) => {
        // Hidden Exit Gesture: Tap the top-left corner (50x50px area) 5 times
        if (e.clientX < 50 && e.clientY < 50) {
          incrementExitGesture();
        }
      }}
    >
      {/* Start Screen (Before Fullscreen) */}
      {!isFullscreen && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-indigo-900 to-purple-900">
          <div className="max-w-2xl text-center">
            <h1 className="text-6xl font-black mb-6 tracking-tight">Kiosk Check-In Mode</h1>
            <p className="text-2xl text-indigo-200 mb-12 leading-relaxed">
              This mode will lock the browser into a full-screen scanning terminal. Students can
              scan their QR codes for instant, hands-free check-in.
            </p>

            <button
              onClick={enterFullscreen}
              className="px-12 py-6 bg-white text-indigo-900 text-3xl font-black rounded-2xl shadow-2xl hover:scale-105 transition-transform active:scale-95"
            >
              ACTIVATE KIOSK
            </button>

            <div className="mt-12 flex items-center justify-center gap-6 text-indigo-300 text-lg">
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Camera Access Required
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Screen Sleep Disabled
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Kiosk Screen */}
      {isFullscreen && (
        <div className="flex-1 relative">
          {/* The Scanner Component */}
          <QRScanner onScanSuccess={handleScan} isActive={status === "scanning"} />

          {/* Status Overlay Feedback */}
          {status !== "scanning" && (
            <div
              className={`
                absolute inset-0 flex flex-col items-center justify-center z-50 transition-all duration-300
                ${status === "success" ? "bg-green-600" : ""}
                ${status === "error" ? "bg-red-600" : ""}
                ${status === "already_checked_in" ? "bg-yellow-600" : ""}
              `}
            >
              {status === "success" && (
                <>
                  <div className="w-48 h-48 bg-white rounded-full flex items-center justify-center mb-8 shadow-2xl">
                    <svg
                      className="w-32 h-32 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h2 className="text-8xl font-black text-white mb-4 tracking-tight">WELCOME!</h2>
                  <p className="text-5xl font-bold text-green-100">{result?.userName}</p>
                  <p className="text-3xl text-green-200 mt-4">Check-in successful</p>
                </>
              )}

              {status === "error" && (
                <>
                  <div className="w-48 h-48 bg-white rounded-full flex items-center justify-center mb-8 shadow-2xl">
                    <svg
                      className="w-32 h-32 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                  <h2 className="text-8xl font-black text-white mb-4 tracking-tight">ERROR</h2>
                  <p className="text-4xl font-bold text-red-100 text-center max-w-3xl px-8">
                    {result?.errorMessage || "Invalid QR Code"}
                  </p>
                  <p className="text-2xl text-red-200 mt-6">
                    Please see a staff member for assistance
                  </p>
                </>
              )}

              {status === "already_checked_in" && (
                <>
                  <div className="w-48 h-48 bg-white rounded-full flex items-center justify-center mb-8 shadow-2xl">
                    <svg
                      className="w-32 h-32 text-yellow-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-7xl font-black text-white mb-4 tracking-tight text-center">
                    ALREADY CHECKED IN
                  </h2>
                  <p className="text-5xl font-bold text-yellow-100">{result?.userName}</p>
                  <p className="text-3xl text-yellow-200 mt-4">You're good to go!</p>
                </>
              )}
            </div>
          )}

          {/* Top Bar (Minimal) */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center text-white/50 text-sm pointer-events-none">
            <span>KIOSK MODE ACTIVE</span>
            <span>Event ID: {eventId?.substring(0, 8)}...</span>
          </div>
        </div>
      )}
    </div>
  );
};
