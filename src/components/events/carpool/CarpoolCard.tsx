import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { CarpoolWithDetails } from "@/lib/supabase/carpool";
import Car from "lucide-react/dist/esm/icons/car";
import Clock from "lucide-react/dist/esm/icons/clock";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Users from "lucide-react/dist/esm/icons/users";

interface CarpoolCardProps {
  carpool: CarpoolWithDetails;
  currentUserId: string | null;
  busy: boolean;
  onClaim: (carpoolId: string) => void;
  onLeave: (carpoolId: string) => void;
  onCancel: (carpoolId: string) => void;
}

function formatDepartureTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function CarpoolCard({
  carpool,
  currentUserId,
  busy,
  onClaim,
  onLeave,
  onCancel,
}: CarpoolCardProps) {
  const isDriver = !!currentUserId && currentUserId === carpool.driver_id;
  const hasSeat = !!carpool.my_passenger_id;
  const isFull = carpool.passenger_count >= carpool.capacity;
  const isCancelled = carpool.status === "cancelled";
  const spotsLeft = Math.max(0, carpool.capacity - carpool.passenger_count);
  const percentage = Math.min(100, Math.round((carpool.passenger_count / carpool.capacity) * 100));

  return (
    <div className="flex flex-col gap-3 border-2 border-black bg-white p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-blue-900/10 text-blue-900">
            <Car className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-sm font-bold text-black">
              {carpool.driver?.full_name || "Unknown driver"}
            </p>
            <p className="text-xs font-mono text-slate-600">
              {carpool.passenger_count}/{carpool.capacity} seats filled
            </p>
          </div>
        </div>
        {isCancelled ? (
          <span className="border border-red-500 bg-red-500/10 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-red-700">
            Cancelled
          </span>
        ) : isFull ? (
          <span className="border border-amber-500 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Full
          </span>
        ) : (
          <span className="border border-emerald-500 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            {spotsLeft} seat{spotsLeft === 1 ? "" : "s"} left
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 text-sm text-black/80">
        <p className="flex items-center gap-2 font-mono">
          <MapPin className="h-4 w-4 shrink-0 text-slate-500" />
          <span>{carpool.meeting_point}</span>
        </p>
        <p className="flex items-center gap-2 font-mono">
          <Clock className="h-4 w-4 shrink-0 text-slate-500" />
          <span>Departs {formatDepartureTime(carpool.departure_time)}</span>
        </p>
        <p className="flex items-center gap-2 font-mono">
          <MessageSquare className="h-4 w-4 shrink-0 text-slate-500" />
          <span>Group chat auto-provisioned for riders</span>
        </p>
      </div>

      {carpool.notes ? <p className="text-sm italic text-slate-600">{carpool.notes}</p> : null}

      {!isCancelled && (
        <div className="relative w-full">
          <Progress
            value={percentage}
            className="h-2.5 border border-black bg-slate-100"
            indicatorClassName={percentage >= 100 ? "bg-red-500" : "bg-blue-900"}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {isCancelled ? (
          <span className="text-xs font-mono text-slate-500">This ride was cancelled.</span>
        ) : isDriver ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => onCancel(carpool.id)}
          >
            Cancel Carpool
          </Button>
        ) : hasSeat ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onLeave(carpool.id)}>
            Leave Ride
          </Button>
        ) : (
          <Button
            variant={isFull ? "secondary" : "primary"}
            size="sm"
            disabled={busy || isFull}
            onClick={() => onClaim(carpool.id)}
          >
            {isFull ? "Full" : "Request Seat"}
          </Button>
        )}
        {!currentUserId && !isCancelled && (
          <span className="text-xs font-mono text-slate-500">
            <Users className="mr-1 inline h-3.5 w-3.5" />
            Sign in to claim a seat
          </span>
        )}
      </div>
    </div>
  );
}
