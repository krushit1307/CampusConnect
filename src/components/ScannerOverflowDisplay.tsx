import React, { useEffect, useState, useCallback } from "react";
import {
  getOverflowQueueStatus,
  generateOverflowQrPayload,
  isEventAtCapacity,
  subscribeToOverflowQueue,
  type OverflowQueueStatus,
} from "../lib/overflowQueue";

interface ScannerOverflowDisplayProps {
  eventId: string;
  eventTitle: string;
}

/**
 * ScannerOverflowDisplay
 *
 * Shown on the door scanner kiosk when an event reaches full capacity.
 * Displays a large QR code that rejected students can scan to join the
 * virtual live-stream queue. Also shows real-time queue stats.
 */
export function ScannerOverflowDisplay({
  eventId,
  eventTitle,
}: ScannerOverflowDisplayProps) {
  const [isFull, setIsFull] = useState(false);
  const [queueStatus, setQueueStatus] = useState<OverflowQueueStatus | null>(
    null
  );
  const [qrPayload, setQrPayload] = useState("");

  const fetchStatus = useCallback(async () => {
    const atCapacity = await isEventAtCapacity(eventId);
    setIsFull(atCapacity);

    if (atCapacity) {
      const status = await getOverflowQueueStatus(eventId);
      setQueueStatus(status);
      setQrPayload(generateOverflowQrPayload(eventId));
    }
  }, [eventId]);

  useEffect(() => {
    fetchStatus();

    const unsubscribe = subscribeToOverflowQueue(eventId, (status) => {
      setQueueStatus(status);
    });

    // Poll capacity every 30 seconds as a fallback
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [eventId, fetchStatus]);

  if (!isFull) {
    return null; // Don't render if event is not at capacity
  }

  return (
    <div
      className="scanner-overflow-display"
      role="alert"
      aria-label="Event at capacity - virtual queue available"
    >
      <div className="overflow-header">
        <span className="overflow-badge">FULL</span>
        <h2>Room Full — Join Virtual Queue</h2>
        <p className="overflow-event-title">{eventTitle}</p>
      </div>

      <div className="overflow-qr-section">
        <p className="overflow-qr-instruction">
          Scan this QR code to join the live stream queue
        </p>

        {/* QR Code rendering — in production, use a QR library like `qrcode.react` */}
        <div
          className="overflow-qr-code"
          data-qr-payload={qrPayload}
          aria-label="QR code to join virtual overflow queue"
        >
          {/* QR code will be rendered by the consuming component using
              a library like qrcode.react or similar.
              The qrPayload string is available via data-qr-payload. */}
          <div className="overflow-qr-placeholder">
            <span>📱</span>
            <p>QR Code</p>
          </div>
        </div>

        <p className="overflow-qr-hint">
          Opens virtual live stream when scanned
        </p>
      </div>

      {queueStatus && (
        <div className="overflow-stats" aria-live="polite">
          <div className="overflow-stat">
            <span className="overflow-stat-value">
              {queueStatus.queue_count}
            </span>
            <span className="overflow-stat-label">In Queue</span>
          </div>
          <div className="overflow-stat">
            <span className="overflow-stat-value">
              {queueStatus.notified_count}
            </span>
            <span className="overflow-stat-label">Notified</span>
          </div>
          <div className="overflow-stat">
            <span className="overflow-stat-value">
              {queueStatus.admitted_count}
            </span>
            <span className="overflow-stat-label">Admitted</span>
          </div>
        </div>
      )}

      <p className="overflow-stream-note">
        {queueStatus?.overflow_stream_url
          ? "Live stream available for virtual queue attendees"
          : "Live stream will be available once you join the queue"}
      </p>
    </div>
  );
}

interface VirtualQueueJoinProps {
  eventId: string;
}

/**
 * VirtualQueueJoin
 *
 * Shown to students who are rejected at the door.
 * Allows them to join the virtual overflow queue with one tap.
 */
export function VirtualQueueJoin({ eventId }: VirtualQueueJoinProps) {
  const [status, setStatus] = useState<OverflowQueueStatus | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOverflowQueueStatus(eventId).then(setStatus);
  }, [eventId]);

  const handleJoinQueue = async () => {
    setJoining(true);
    setError(null);

    try {
      const { joinVirtualQueue } = await import("../lib/overflowQueue");
      const result = await joinVirtualQueue(eventId);

      if (result.success) {
        // Refresh status
        const updated = await getOverflowQueueStatus(eventId);
        setStatus(updated);
      } else {
        setError(result.error || "Failed to join queue");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  // If user is already in queue, show their position
  if (status?.user_position) {
    const pos = status.user_position;
    return (
      <div className="virtual-queue-status" role="status" aria-live="polite">
        <h3>Your Queue Status</h3>
        <div className="queue-position">
          Position: <strong>#{pos.queue_position}</strong>
        </div>
        <div className="queue-status-badge" data-status={pos.status}>
          {pos.status === "waiting" && "Waiting for a seat..."}
          {pos.status === "notified" && (
            <>
              <strong>A seat is available!</strong>
              <p>
                You have 2 minutes to claim it at the door.
                {pos.claim_deadline && (
                  <span className="claim-deadline">
                    {" "}
                    Deadline:{" "}
                    {new Date(pos.claim_deadline).toLocaleTimeString()}
                  </span>
                )}
              </p>
            </>
          )}
          {pos.status === "admitted" && "You have been admitted!"}
          {pos.status === "expired" && "Your claim window expired."}
        </div>
      </div>
    );
  }

  return (
    <div className="virtual-queue-join">
      <h3>Room is Full</h3>
      <p>Join the virtual queue to watch the live stream.</p>

      {error && (
        <div className="queue-error" role="alert">
          {error}
        </div>
      )}

      <button
        onClick={handleJoinQueue}
        disabled={joining}
        className="queue-join-btn"
        aria-label="Join virtual overflow queue"
      >
        {joining ? "Joining..." : "Join Virtual Queue"}
      </button>

      {status && (
        <p className="queue-count-info">
          {status.queue_count} people currently in queue
        </p>
      )}
    </div>
  );
}
