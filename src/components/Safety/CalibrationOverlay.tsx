import { useEffect, useState } from "react";
import { Activity, Smartphone } from "lucide-react";

interface CalibrationOverlayProps {
  /** 0..100 progress percent. */
  progress: number;
}

/**
 * Onboarding overlay shown during the kinematic baseline calibration phase.
 * The user is asked to use their device normally so the continuous-auth system
 * can learn their unique holding angle, gait, and typing rhythm.
 */
export function CalibrationOverlay({ progress }: CalibrationOverlayProps) {
  const pct = Math.round(progress * 100);
  const [hint, setHint] = useState("Hold your phone as you normally do.");

  useEffect(() => {
    // Cycle through helpful hints.
    const hints = [
      "Hold your phone as you normally do.",
      "Walk around a bit — we are learning your unique gait.",
      "Type a few messages so we can learn your typing rhythm.",
    ];
    const idx = Math.min(hints.length - 1, Math.floor(pct / 34));
    setHint(hints[idx]);
  }, [pct]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="neu-border w-full max-w-sm bg-cream p-8 shadow-[8px_8px_0_0_var(--color-ink)]">
        <div className="mb-4 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black">
            <Smartphone className="h-6 w-6 animate-pulse text-peach" />
          </div>
        </div>

        <h2 className="text-center font-display text-lg font-bold text-black">
          Learning your safety signature
        </h2>
        <p className="mt-2 text-center font-mono text-xs leading-relaxed text-gray-600">
          For continuous protection, we are calibrating the way you hold and move your device. Use
          your phone normally for a few moments.
        </p>

        <div className="mt-6">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] font-bold uppercase text-gray-500">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" /> Calibrating
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full border border-black bg-white">
            <div
              className="h-full bg-black transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <p className="mt-4 text-center font-mono text-[11px] italic text-gray-500">{hint}</p>
      </div>
    </div>
  );
}
