import { useState, useEffect } from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  Radio,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  UserX,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PresenterState,
  calculateRemainingSeconds,
  shouldTriggerFallbackOnAwol,
} from "@/lib/presenterPing";

interface GreenRoomPresenterPingDashboardProps {
  presenters: PresenterState[];
  onPingPresenter: (presenterId: string) => Promise<void>;
  onPingAll: () => Promise<void>;
  onActivateFallback?: (reason: string) => Promise<void>;
  onResetPresenter?: (presenterId: string) => void;
}

export function GreenRoomPresenterPingDashboard({
  presenters,
  onPingPresenter,
  onPingAll,
  onActivateFallback,
  onResetPresenter,
}: GreenRoomPresenterPingDashboardProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isPinging, setIsPinging] = useState<string | null>(null);

  // 100ms clock updater for smooth countdowns
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

  const handlePing = async (presenterId: string) => {
    setIsPinging(presenterId);
    try {
      await onPingPresenter(presenterId);
    } finally {
      setIsPinging(null);
    }
  };

  const hasAwolPresenter = presenters.some((p) => shouldTriggerFallbackOnAwol(p));

  return (
    <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] text-black">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b-2 border-black pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <p className="font-mono text-xs font-black uppercase tracking-wider text-black/70">
              Green Room Readiness Verification
            </p>
          </div>
          <h2 className="font-display text-2xl font-black uppercase mt-1">
            Active Presenter Ping Controls
          </h2>
          <p className="font-mono text-xs text-black/60 mt-1">
            Perform an active behavioural check to ensure online presenters are at their keyboards
            before live stream broadcast.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => void onPingAll()}
            className="neu-border bg-yellow-300 hover:bg-yellow-400 text-black font-mono text-xs font-black uppercase tracking-wider shadow-[2px_2px_0_0_#000]"
          >
            <BellRing className="mr-1.5 h-4 w-4" /> Ping All Presenters
          </Button>
        </div>
      </div>

      {/* AWOL Warning Banner */}
      {hasAwolPresenter && (
        <div className="mt-4 border-2 border-red-600 bg-red-100 p-4 font-mono text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 text-red-900 font-bold">
              <ShieldAlert className="h-6 w-6 text-red-600 shrink-0 animate-bounce" />
              <div>
                <p className="uppercase text-sm">⚠️ CRITICAL: Presenter AWOL Detected!</p>
                <p className="text-xs text-red-800 font-normal mt-0.5">
                  One or more presenters did not confirm readiness within 15 seconds. Prepare the
                  fallback video slate immediately.
                </p>
              </div>
            </div>
            {onActivateFallback && (
              <Button
                type="button"
                onClick={() =>
                  void onActivateFallback(
                    "Presenter failed 15-second Audio/Visual ping readiness check (AWOL).",
                  )
                }
                className="neu-border border-red-700 bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-black uppercase whitespace-nowrap shadow-[2px_2px_0_0_#000]"
              >
                <AlertTriangle className="mr-1.5 h-4 w-4" /> Activate Fallback Slate
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Presenter Table / Card Grid */}
      <div className="mt-5 divide-y-2 divide-black border-2 border-black">
        {presenters.length > 0 ? (
          presenters.map((presenter) => {
            const secondsRemaining = calculateRemainingSeconds(presenter.timeoutAt, currentTime);
            const isPinged = presenter.pingStatus === "pinged" && secondsRemaining > 0;
            const isConfirmed = presenter.pingStatus === "confirmed_ready";
            const isAwol =
              presenter.pingStatus === "awol" ||
              (presenter.pingStatus === "pinged" && secondsRemaining === 0);

            return (
              <div
                key={presenter.id}
                className={`p-4 transition-colors ${
                  isConfirmed
                    ? "bg-lime-50"
                    : isAwol
                      ? "bg-red-50"
                      : isPinged
                        ? "bg-yellow-50"
                        : "bg-white"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Presenter Info */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {presenter.avatarUrl ? (
                        <img
                          src={presenter.avatarUrl}
                          alt={presenter.name}
                          className="h-10 w-10 border-2 border-black object-cover rounded-none"
                        />
                      ) : (
                        <div className="h-10 w-10 border-2 border-black bg-gray-200 flex items-center justify-center font-mono font-bold text-sm">
                          {presenter.name?.charAt(0) || "P"}
                        </div>
                      )}
                      <span
                        className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 border-2 border-black rounded-full ${
                          presenter.connectionState === "connected"
                            ? "bg-lime-500"
                            : presenter.connectionState === "checking"
                              ? "bg-yellow-400"
                              : "bg-red-500"
                        }`}
                        title={`Connection: ${presenter.connectionState}`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black uppercase">
                          {presenter.name}
                        </span>
                        <span className="border border-black px-1.5 py-0.5 font-mono text-[10px] uppercase bg-gray-100">
                          {presenter.connectionState}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-black/60">ID: {presenter.id}</p>
                    </div>
                  </div>

                  {/* Status Indicator & Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Status Badge */}
                    {isConfirmed && (
                      <div className="flex items-center gap-1.5 border-2 border-black bg-lime-400 px-3 py-1.5 font-mono text-xs font-black uppercase text-black shadow-[2px_2px_0_0_#000]">
                        <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
                        <span>Confirmed Ready</span>
                      </div>
                    )}

                    {isPinged && (
                      <div className="flex items-center gap-2 border-2 border-black bg-yellow-300 px-3 py-1.5 font-mono text-xs font-black uppercase text-black animate-pulse shadow-[2px_2px_0_0_#000]">
                        <Clock className="h-4 w-4 animate-spin" />
                        <span>Waiting... ({secondsRemaining}s)</span>
                      </div>
                    )}

                    {isAwol && (
                      <div className="flex items-center gap-1.5 border-2 border-black bg-red-600 px-3 py-1.5 font-mono text-xs font-black uppercase text-white shadow-[2px_2px_0_0_#000]">
                        <UserX className="h-4 w-4" />
                        <span>AWOL (No Response)</span>
                      </div>
                    )}

                    {presenter.pingStatus === "idle" && (
                      <div className="border border-black bg-gray-100 px-2.5 py-1 font-mono text-xs font-bold uppercase text-black/60">
                        Awaiting Ping
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => void handlePing(presenter.id)}
                        disabled={isPinging === presenter.id || isPinged}
                        className={`neu-border font-mono text-xs font-black uppercase shadow-[2px_2px_0_0_#000] ${
                          isConfirmed
                            ? "bg-white hover:bg-gray-100 text-black border-black"
                            : isAwol
                              ? "bg-red-500 hover:bg-red-600 text-white border-black"
                              : "bg-black hover:bg-black/80 text-white"
                        }`}
                      >
                        <BellRing className="mr-1.5 h-3.5 w-3.5" />
                        {isPinged ? "Ping Active" : "Ping Presenter"}
                      </Button>

                      {onResetPresenter && (isConfirmed || isAwol) && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onResetPresenter(presenter.id)}
                          className="neu-border border-black bg-white text-black font-mono text-xs font-bold uppercase p-2"
                          title="Reset status"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center font-mono text-sm text-black/50">
            No active presenter WebRTC connections in the Green Room.
          </div>
        )}
      </div>
    </div>
  );
}
