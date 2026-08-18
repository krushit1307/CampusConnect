import { useState } from "react";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useGeofencedCheckIn } from "@/hooks/useGeofencedCheckIn";

interface GeofencedCheckInButtonProps {
  rsvpId: string;
  /** Whether the organizer has geofencing turned on for this event. */
  geofencingEnabled: boolean;
  onCheckedIn?: () => void;
  className?: string;
}

/**
 * Self check-in button shown to attendees who have RSVP'd. Requests the
 * device's GPS location and asks the server to verify it's within the
 * event's geofence before marking the attendee as checked in.
 *
 * If the organizer disabled geofencing for this event (e.g. an indoor venue
 * with unreliable GPS), this renders a hint pointing them to organizer
 * check-in instead, rather than a button that will always fail.
 */
export function GeofencedCheckInButton({
  rsvpId,
  geofencingEnabled,
  onCheckedIn,
  className,
}: GeofencedCheckInButtonProps) {
  const { status, errorMessage, distanceMeters, radiusMeters, checkIn, reset } =
    useGeofencedCheckIn();
  const [attempted, setAttempted] = useState(false);

  const isBusy = status === "requesting_location" || status === "verifying";

  const handleClick = async () => {
    setAttempted(true);
    const outcome = await checkIn(rsvpId);
    if (outcome.status === "success") {
      toast.success("You're checked in!");
      onCheckedIn?.();
    } else if (outcome.status === "already_checked_in") {
      toast.success("You're already checked in.");
      onCheckedIn?.();
    } else if (outcome.status === "too_far") {
      toast.error(outcome.errorMessage || "You're too far from the event to check in.");
    } else {
      toast.error(outcome.errorMessage || "Check-in failed. Please try again.");
    }
  };

  if (!geofencingEnabled) {
    return (
      <p className={`flex items-center gap-1.5 font-mono text-xs text-black/50 ${className || ""}`}>
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        Self check-in isn&apos;t enabled for this event — check in with an organizer at the venue.
      </p>
    );
  }

  return (
    <div className={className}>
      <Button
        onClick={handleClick}
        disabled={isBusy}
        variant="primary"
        size="lg"
        className="flex items-center gap-2"
      >
        {isBusy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {status === "requesting_location" ? "Getting your location..." : "Verifying..."}
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4" />
            Check In (Verify Location)
          </>
        )}
      </Button>

      {attempted && status === "too_far" && (
        <div className="mt-2 flex items-start gap-1.5 font-mono text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            {errorMessage ||
              (typeof distanceMeters === "number" && typeof radiusMeters === "number"
                ? `You're ${Math.round(distanceMeters)}m away; you need to be within ${radiusMeters}m.`
                : "You're too far from the event to check in.")}{" "}
            <button
              type="button"
              onClick={reset}
              className="underline underline-offset-2 hover:text-amber-900"
            >
              Try again
            </button>
          </span>
        </div>
      )}

      {attempted && status === "error" && (
        <div className="mt-2 flex items-start gap-1.5 font-mono text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            {errorMessage || "Check-in failed."}{" "}
            <button
              type="button"
              onClick={reset}
              className="underline underline-offset-2 hover:text-destructive/80"
            >
              Try again
            </button>
          </span>
        </div>
      )}

      {status === "success" && (
        <div className="mt-2 flex items-center gap-1.5 font-mono text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Checked in
          {typeof distanceMeters === "number" ? ` — ${Math.round(distanceMeters)}m from venue` : ""}
        </div>
      )}
    </div>
  );
}
