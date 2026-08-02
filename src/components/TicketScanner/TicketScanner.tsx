import React, { useState, useRef, useEffect, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { validateTicket, TicketValidationResponse } from "../../services/ticketValidation";
import { playSuccessBeep } from "../../lib/audio/beep";
import styles from "./TicketScanner.module.css";

interface TicketScannerProps {
  onValidationComplete?: (result: TicketValidationResponse) => void;
}

export const TicketScanner: React.FC<TicketScannerProps> = ({ onValidationComplete }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraId, setCameraId] = useState<string>("");
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [scanResult, setScanResult] = useState<TicketValidationResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Initialize cameras on mount
  useEffect(() => {
    const initializeCameras = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          // Filter for rear/environment facing cameras if possible
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
        alert("Camera access is required for QR scanning. Please grant permissions.");
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
      scannerRef.current = new Html5Qrcode("qr-reader-container");
      await scannerRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          // Pause scanner on successful decode
          if (scannerRef.current) {
            await scannerRef.current.pause();
          }
          setIsProcessing(true);
          playSuccessBeep();

          const result = await validateTicket(decodedText);
          setScanResult(result);
          setIsProcessing(false);

          if (onValidationComplete) {
            onValidationComplete(result);
          }
        },
        (errorMessage) => {
          // Ignore continuous scan errors, they are normal
        },
      );
      setIsScanning(true);
    } catch (err) {
      console.error("Failed to start scanner:", err);
      alert("Failed to start camera. Please check permissions.");
    }
  }, [cameraId, onValidationComplete]);

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
    const nextCameraId = availableCameras[nextIndex].id;

    setCameraId(nextCameraId);
    if (isScanning) {
      await stopScanning();
      // Small delay to ensure clean stop before restarting
      setTimeout(() => startScanning(), 500);
    }
  }, [availableCameras, cameraId, isScanning, startScanning, stopScanning]);

  const resetScanner = useCallback(async () => {
    setScanResult(null);
    if (scannerRef.current) {
      await scannerRef.current.resume();
    }
  }, []);

  return (
    <div className={styles.scannerWrapper}>
      <div ref={scannerContainerRef} id="qr-reader-container" className={styles.scannerContainer}>
        {isScanning && !isProcessing && !scanResult && (
          <>
            <div className={styles.scanningReticle}>
              <div className={styles.scanLine} />1
            </div>
            <div className={styles.controls}>
              <button
                className={styles.controlButton}
                onClick={switchCamera}
                disabled={availableCameras.length <= 1}
              >
                Switch Camera (
                {availableCameras.length > 1
                  ? availableCameras.findIndex((c) => c.id === cameraId) + 1
                  : 1}
                /{availableCameras.length})
              </button>
              <button className={styles.controlButton} onClick={stopScanning}>
                Stop Scanner
              </button>
            </div>
          </>
        )}

        {!isScanning && !scanResult && (
          <div className={styles.controls}>
            <button className={styles.controlButton} onClick={startScanning}>
              Start Scanning
            </button>
          </div>
        )}
      </div>

      {scanResult && (
        <>
          <div className={styles.overlay} onClick={resetScanner} />
          <div
            className={`${styles.resultModal} ${scanResult.isValid ? styles.success : styles.error}`}
          >
            <div className={styles.resultIcon}>{scanResult.isValid ? "✅" : "❌"}</div>
            <h2>{scanResult.isValid ? "Valid Ticket" : "Invalid Ticket"}</h2>
            <p>{scanResult.message}</p>
            {scanResult.isValid && scanResult.attendeeName && (
              <p className={styles.attendeeInfo}>
                <strong>Attendee:</strong> {scanResult.attendeeName}
              </p>
            )}
            <button
              className={`${styles.controlButton} ${styles.resetButton}`}
              onClick={resetScanner}
              style={{ marginTop: "1.5rem", width: "100%" }}
            >
              Scan Next Ticket
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TicketScanner;
