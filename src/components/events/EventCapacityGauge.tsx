import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Users, Flame, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventCapacityGaugeProps {
  eventId: string;
  initialCapacity?: number;
  maxAttendees: number | null;
  className?: string;
  showDetails?: boolean;
}

export const EventCapacityGauge: React.FC<EventCapacityGaugeProps> = ({
  eventId,
  initialCapacity = 0,
  maxAttendees,
  className = "",
  showDetails = true,
}) => {
  const [currentCapacity, setCurrentCapacity] = useState<number>(initialCapacity);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const supabase = createClient();

  useEffect(() => {
    setCurrentCapacity(initialCapacity);
  }, [initialCapacity]);

  // Subscribe to Supabase Realtime updates on event_rsvps table for this event
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`event-capacity-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_rsvps",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 800);

          if (payload.eventType === "INSERT") {
            setCurrentCapacity((prev) => prev + 1);
          } else if (payload.eventType === "DELETE") {
            setCurrentCapacity((prev) => Math.max(0, prev - 1));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  if (!maxAttendees || maxAttendees <= 0) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs font-mono text-slate-600", className)}>
        <Users className="w-3.5 h-3.5 text-slate-400" />
        <span>{currentCapacity} attending (Unlimited Capacity)</span>
      </div>
    );
  }

  const spotsLeft = Math.max(0, maxAttendees - currentCapacity);
  const percentage = Math.min(100, Math.round((currentCapacity / maxAttendees) * 100));

  // Determine urgency status
  let badgeColor = "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  let statusText = `${spotsLeft} spots available`;
  let Icon = Users;

  if (spotsLeft === 0) {
    badgeColor = "bg-red-500/10 text-red-700 border-red-500/30 font-bold";
    statusText = "Event Sold Out!";
    Icon = AlertTriangle;
  } else if (spotsLeft <= 5) {
    badgeColor = "bg-amber-500/10 text-amber-700 border-amber-500/30 font-bold animate-pulse";
    statusText = `Only ${spotsLeft} spots left!`;
    Icon = Flame;
  } else if (percentage >= 80) {
    badgeColor = "bg-orange-500/10 text-orange-700 border-orange-500/30";
    statusText = `Filling fast (${spotsLeft} left)`;
    Icon = Flame;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3 rounded-lg border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
        className,
      )}
    >
      <div className="flex items-center justify-between text-xs font-mono font-bold">
        <div className="flex items-center gap-1.5">
          <Icon className="w-4 h-4 text-brand-blue-dark" />
          <span>Capacity Gauge</span>
        </div>
        <span
          className={cn(
            "px-2 py-0.5 rounded text-[11px] uppercase tracking-wider border transition-all duration-300",
            badgeColor,
            isAnimating && "scale-110",
          )}
        >
          {statusText}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full">
        <Progress value={percentage} className="h-3.5 border-2 border-black bg-slate-100" />
      </div>

      {showDetails && (
        <div className="flex items-center justify-between text-xs font-mono text-slate-700 pt-0.5">
          <span>
            <strong>{currentCapacity}</strong> / {maxAttendees} spots filled
          </span>
          <span className="font-bold">{percentage}%</span>
        </div>
      )}
    </div>
  );
};
