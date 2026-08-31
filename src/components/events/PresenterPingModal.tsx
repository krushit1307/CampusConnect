import { useEffect, useState } from "react";
import { AlertCircle, Bell, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PresenterPingPayload, calculateRemainingSeconds } from "@/lib/presenterPing";

interface PresenterPingModalProps {
  ping: PresenterPingPayload | null;
  onConfirm: () => void;
}

export function PresenterPingModal({ ping, onConfirm }: PresenterPingModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(15);

  useEffect(() => {
    if (!ping) return;

    const timeoutAt = ping.timestamp + ping.timeoutSeconds * 1000;
    setSecondsRemaining(calculateRemainingSeconds(timeoutAt));

    const interval = setInterval(() => {
      const remaining = calculateRemainingSeconds(timeoutAt);
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [ping]);

  if (!ping) return null;

  const progressPercent = Math.max(
    0,
    Math.min(100, (secondsRemaining / (ping.timeoutSeconds || 15)) * 100),
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="presenter-ping-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
    >
      {/* Flashing Red High-Urgency Backdrop */}
      <div className="absolute inset-0 bg-red-600/80 animate-pulse transition-opacity backdrop-blur-md" />

      {/* Massive Urgent Modal Box */}
      <div className="relative z-10 w-full max-w-2xl border-4 border-black bg-white p-6 sm:p-10 shadow-[12px_12px_0_0_#000] text-black">
        <div className="flex items-center justify-between border-b-4 border-black pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center border-2 border-black bg-red-500 text-white animate-bounce">
              <Bell className="h-7 w-7" />
            </span>
            <div>
              <p className="font-mono text-xs font-black uppercase tracking-wider text-red-600">
                ⚠️ Live Broadcast Imminent — Action Required
              </p>
              <h1
                id="presenter-ping-title"
                className="font-display text-3xl font-black uppercase sm:text-4xl leading-none mt-1"
              >
                ARE YOU READY?
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 border-2 border-black bg-yellow-300 px-3 py-1.5 font-mono text-lg font-black">
            <Clock className="h-5 w-5 animate-spin" />
            <span>{secondsRemaining}s</span>
          </div>
        </div>

        {/* 15-Second Urgent Countdown Bar */}
        <div className="mt-6">
          <div className="flex justify-between font-mono text-xs font-bold uppercase mb-1">
            <span>Readiness Verification Window</span>
            <span>{secondsRemaining}s remaining</span>
          </div>
          <div className="h-5 w-full border-2 border-black bg-gray-200 overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ease-linear ${
                secondsRemaining <= 5 ? "bg-red-600 animate-pulse" : "bg-lime-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Modal Body Info */}
        <div className="mt-6 border-2 border-black bg-amber-50 p-4 font-mono text-sm">
          <p className="font-bold flex items-center gap-2 text-amber-900">
            <AlertCircle className="h-5 w-5 text-amber-700 shrink-0" />
            The event organizer has requested an active Audio/Visual presence check.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Confirm your presence immediately. If no confirmation is received within 15 seconds, you
            will be flagged as <strong>AWOL</strong> and the stream will transition to the fallback
            slate.
          </p>
        </div>

        {/* Massive Confirm Action Button */}
        <div className="mt-8">
          <Button
            type="button"
            onClick={onConfirm}
            className="w-full h-16 border-4 border-black bg-lime-400 text-black text-xl sm:text-2xl font-display font-black uppercase tracking-wider shadow-[6px_6px_0_0_#000] hover:bg-lime-300 hover:translate-x-1 hover:translate-y-1 hover:shadow-[2px_2px_0_0_#000] active:translate-x-1.5 active:translate-y-1.5 active:shadow-none transition-all flex items-center justify-center gap-3 cursor-pointer"
          >
            <CheckCircle2 className="h-8 w-8 text-black stroke-[2.5]" />
            Click to Confirm Ready!
          </Button>
        </div>
      </div>
    </div>
  );
}
