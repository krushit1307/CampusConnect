// src/components/events/EventRsvpButton.tsx
import { useEffect, useState } from "react";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Users from "lucide-react/dist/esm/icons/users";
import Clock from "lucide-react/dist/esm/icons/clock";
import Check from "lucide-react/dist/esm/icons/check";
import X from "lucide-react/dist/esm/icons/x";
import { Button } from "../ui/button";
import {
  joinEventOrWaitlist,
  cancelEventRsvp,
  getEventRsvpState,
  type EventRsvpState,
} from "../../lib/waitlist";
 feature/carpool-matching-2877
import { useIdempotentPayment } from "../../hooks/useIdempotentPayment";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import { Label } from "../ui/label";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { ResumeDropzone } from "../resume/ResumeDropzone";
 main

interface EventRsvpButtonProps {
  eventId: string;
  userId: string | undefined;
  /** Optional initial state to avoid a flash of loading state. */
  initialState?: EventRsvpState | null;
  /** Called after a successful join / cancel so the parent can refresh. */
  onRsvpChanged?: () => void;
}

/**
 * The RSVP / Join Waitlist / Cancel button for an event detail page.
 *
 * Renders one of five states based on the event's capacity and the
 * calling user's RSVP status:
 *
 *   1. Not RSVPed, spots available  →  "RSVP NOW"  (primary)
 *   2. Not RSVPed, event full       →  "Join Waitlist"  (secondary)
 *      + banner: "Event Full — N people on Waitlist"
 *   3. Already attending            →  "✓ Attending" + "Cancel RSVP"
 *   4. On waitlist                  →  "On Waitlist ✓ (Position #N)" + "Leave Waitlist"
 *   5. Not logged in                 →  "Log in to RSVP"  (disabled)
 *
 * The button calls the `join_event_or_waitlist` and `cancel_event_rsvp`
 * Postgres RPCs, which are the race-condition-safe paths described in
 * issue #2693. The frontend never does a raw INSERT into event_rsvps.
 */
export function EventRsvpButton({
  eventId,
  userId,
  initialState,
  onRsvpChanged,
}: EventRsvpButtonProps) {
  const [state, setState] = useState<EventRsvpState | null>(initialState ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);

  // Mocking a ticket price since database schema lacks it currently
  const ticketPrice = 14.5;
  const isPaidEvent = true;

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [roundUp, setRoundUp] = useState(false);

  const { processPayment, isProcessing } = useIdempotentPayment();

  // Fetch the RSVP state on mount if no initial state was provided.
  useEffect(() => {
    if (initialState) {
      setState(initialState);
      return;
    }
    let cancelled = false;
    (async () => {
      const fetched = await getEventRsvpState(eventId, userId);
      if (!cancelled) setState(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, userId, initialState]);

  const handleJoinClick = () => {
    if (!userId) {
      setError("Please log in to RSVP.");
      return;
    }
    if (state?.is_resume_required) {
      setIsResumeModalOpen(true);
    } else {
      executeJoin();
    }
  };

  const executeJoin = async (resumePath?: string) => {
    if (!userId) return;

    setLoading(true);
    setError(null);
    setIsResumeModalOpen(false);

    const result = await joinEventOrWaitlist(eventId, userId, resumePath);

    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    // Refresh the state to reflect the new RSVP.
    const fresh = await getEventRsvpState(eventId, userId);
    setState(fresh);
    onRsvpChanged?.();
  };

  const handleCheckout = async () => {
    if (!userId) {
      setError("Please log in to RSVP.");
      return;
    }

    try {
      await processPayment({
        eventId,
        quantity: 1,
        amount: ticketPrice * 100, // Cents
        includeCharityDonation: roundUp,
      });
      setIsCheckoutModalOpen(false);
      // Mock update to UI since we don't have the full webhook pipeline available locally
      setState((prev) => (prev ? { ...prev, user_status: "attending" } : prev));
      onRsvpChanged?.();
    } catch (err: any) {
      // Error handled by hook
    }
  };

  const handleCancel = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const result = await cancelEventRsvp(eventId, userId);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const fresh = await getEventRsvpState(eventId, userId);
    setState(fresh);
    onRsvpChanged?.();
  };

  const renderResumeModal = () => (
    <Dialog open={isResumeModalOpen} onOpenChange={setIsResumeModalOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resume Required</DialogTitle>
          <DialogDescription>
            The organizer requires a resume for this event. Please upload a PDF under 2MB.
          </DialogDescription>
        </DialogHeader>
        {userId && (
          <ResumeDropzone
            eventId={eventId}
            userId={userId}
            onUploadSuccess={(path) => executeJoin(path)}
          />
        )}
      </DialogContent>
    </Dialog>
  );

  // ── Loading state ──────────────────────────────────────────────
  if (state === null) {
    return (
      <Button disabled size="lg" aria-label="Loading RSVP state">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  // ── Not logged in ──────────────────────────────────────────────
  if (!userId) {
    return (
      <div className="flex flex-col gap-2">
        <Button disabled size="lg">
          Log in to RSVP
        </Button>
      </div>
    );
  }

  const userStatus = state.user_status;

  // ── Already attending ──────────────────────────────────────────
  if (userStatus === "attending") {
    return (
      <div className="flex flex-col gap-2">
        <Button disabled size="lg" variant="secondary" className="gap-2">
          <Check className="h-4 w-4" aria-hidden="true" />
          Attending
        </Button>
        <Button
          onClick={handleCancel}
          disabled={loading}
          variant="ghost"
          size="sm"
          className="gap-1 text-red-600 hover:text-red-700"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          Cancel RSVP
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ── On waitlist ─────────────────────────────────────────────────
  if (userStatus === "waitlisted") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button disabled size="lg" variant="secondary" className="gap-2">
            <Clock className="h-4 w-4" aria-hidden="true" />
            On Waitlist
            {state.user_waitlist_position && (
              <span className="font-mono text-xs">(#{state.user_waitlist_position})</span>
            )}
          </Button>
          <Button
            onClick={handleCancel}
            disabled={loading}
            variant="ghost"
            size="sm"
            className="gap-1 text-red-600 hover:text-red-700"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Leave Waitlist
          </Button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          You'll be automatically promoted and emailed if a spot opens up.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ── Not RSVPed, event full → Join Waitlist ──────────────────────
  if (state.is_full) {
    return (
      <div className="flex flex-col gap-2">
        {renderResumeModal()}
        <div
          className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
          role="status"
        >
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>
            <strong>Event Full</strong>
            {state.waitlist_count > 0 && (
              <>
                {" "}
                — {state.waitlist_count} {state.waitlist_count === 1 ? "person" : "people"} on
                Waitlist
              </>
            )}
          </span>
        </div>
        <Button onClick={handleJoinClick} disabled={loading} size="lg" className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
          Join Waitlist
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ── Not RSVPed, spots available → RSVP NOW ──────────────────────
  return (
 feature/carpool-matching-2877
    <>
      <div className="flex flex-col gap-2">
        {isPaidEvent ? (
          <Button
            onClick={() => setIsCheckoutModalOpen(true)}
            disabled={loading}
            size="lg"
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Buy Ticket
          </Button>
        ) : (
          <Button onClick={handleJoin} disabled={loading} size="lg" className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            RSVP NOW
          </Button>
        )}
        {state.max_attendees && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {state.attending_count} / {state.max_attendees} spots filled
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <Dialog open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Your Purchase</DialogTitle>
            <DialogDescription>
              Ticket for this event costs ${ticketPrice.toFixed(2)}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center space-x-2 my-4 p-4 border rounded-md bg-slate-50 dark:bg-slate-900">
            <Checkbox
              id="round-up"
              checked={roundUp}
              onCheckedChange={(checked) => setRoundUp(checked as boolean)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="round-up" className="font-semibold cursor-pointer">
                Round up to ${Math.ceil(ticketPrice).toFixed(2)} to support the Campus Food Bank?
              </Label>
              <p className="text-sm text-slate-500">
                Donate the ${(Math.ceil(ticketPrice) - ticketPrice).toFixed(2)} difference to our
                student food bank.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCheckoutModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckout} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Pay $${(roundUp ? Math.ceil(ticketPrice) : ticketPrice).toFixed(2)}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>

    <div className="flex flex-col gap-2">
      {renderResumeModal()}
      <Button onClick={handleJoinClick} disabled={loading} size="lg" className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
        RSVP NOW
      </Button>
      {state.max_attendees && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {state.attending_count} / {state.max_attendees} spots filled
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
 main
  );
}
