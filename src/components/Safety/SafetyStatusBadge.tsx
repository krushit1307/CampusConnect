import { useEffect, useState } from "react";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { threatLevelSignal, type ThreatLevel } from "@/store/globalState";
import { cn } from "@/lib/utils";

interface SafetyStatusBadgeProps {
  /** Optional override; when omitted, subscribes to the global threat signal. */
  threatLevel?: ThreatLevel;
  /** When true, sensor monitoring is unavailable (reduced protection). */
  reduced?: boolean;
}

const CONFIG: Record<ThreatLevel, { label: string; icon: typeof ShieldCheck; className: string }> =
  {
    normal: {
      label: "Protected",
      icon: ShieldCheck,
      className: "bg-lime text-black border-black",
    },
    elevated: {
      label: "Monitoring",
      icon: ShieldAlert,
      className: "bg-amber-300 text-black border-black",
    },
    critical: {
      label: "Critical",
      icon: ShieldAlert,
      className: "bg-destructive text-white border-black",
    },
  };

/**
 * Small status indicator shown in the navbar, surfacing the current
 * continuous-authentication threat level.
 */
export function SafetyStatusBadge({ threatLevel, reduced = false }: SafetyStatusBadgeProps) {
  const [liveThreat, setLiveThreat] = useState<ThreatLevel>(() => threatLevelSignal.peek());

  useEffect(() => {
    if (threatLevel !== undefined) return;
    const unsubscribe = threatLevelSignal.subscribe(setLiveThreat);
    return unsubscribe;
  }, [threatLevel]);

  const level = threatLevel ?? liveThreat;
  const cfg = CONFIG[level];
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "neu-border inline-flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide",
        cfg.className,
        reduced && "bg-amber-200 text-gray-700",
      )}
      title={
        reduced
          ? "Safety monitoring is reduced (sensors unavailable)"
          : `Continuous authentication: ${cfg.label}`
      }
    >
      <Icon className="h-3 w-3" />
      {reduced ? "Reduced" : cfg.label}
    </div>
  );
}
