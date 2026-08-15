import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import {
  cancelCarpool,
  claimCarpoolSeat,
  fetchCarpoolsForEvent,
  leaveCarpool,
  offerCarpool,
  type CarpoolWithDetails,
} from "@/lib/supabase/carpool";
import { CarpoolCard } from "./CarpoolCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Car from "lucide-react/dist/esm/icons/car";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";

interface CarpoolSectionProps {
  eventId: string;
  user: User | null;
}

export function CarpoolSection({ eventId, user }: CarpoolSectionProps) {
  const supabase = createClient();
  const [carpools, setCarpools] = useState<CarpoolWithDetails[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [capacity, setCapacity] = useState(4);
  const [departureTime, setDepartureTime] = useState("");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [notes, setNotes] = useState("");
  const carpoolsRef = useRef<CarpoolWithDetails[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await fetchCarpoolsForEvent(eventId, user?.id);
    if (error) {
      console.error("Failed to load carpools:", error);
      setCarpools([]);
      setLoading(false);
      return;
    }
    setCarpools(data ?? []);
    setLoading(false);
  }, [eventId, user?.id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    carpoolsRef.current = carpools ?? [];
  }, [carpools]);

  // Realtime: refresh carpools instantly when a carpool is created/cancelled or
  // when someone claims/releases a seat on one of the loaded carpools.
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`carpool-realtime-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "carpools", filter: `event_id=eq.${eventId}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "carpool_passengers" },
        (payload) => {
          const record = (payload.new ?? payload.old) as { carpool_id?: string } | undefined;
          if (record?.carpool_id && carpoolsRef.current.some((c) => c.id === record.carpool_id)) {
            void load();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase, load]);

  const runAction = async (
    action: () => Promise<{
      data: { success: boolean; message: string } | null;
      error: unknown;
    }>,
    carpoolId: string,
    successMessage: string,
  ) => {
    setBusyId(carpoolId);
    try {
      const { data, error } = await action();
      if (error) {
        toast.error("Something went wrong. Please try again.");
        return;
      }
      if (data?.success) {
        toast.success(successMessage);
      } else {
        toast.error(data?.message ?? "Action failed");
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleClaim = (carpoolId: string) =>
    runAction(() => claimCarpoolSeat(carpoolId), carpoolId, "Seat claimed!");

  const handleLeave = (carpoolId: string) =>
    runAction(() => leaveCarpool(carpoolId), carpoolId, "You left the carpool");

  const handleCancel = (carpoolId: string) => {
    if (!window.confirm("Cancel this carpool? All attached riders will be notified.")) return;
    runAction(() => cancelCarpool(carpoolId), carpoolId, "Carpool cancelled");
  };

  const handleOffer = async (e: FormEvent) => {
    e.preventDefault();
    if (!departureTime) {
      toast.error("Please pick a departure time.");
      return;
    }
    if (!meetingPoint.trim()) {
      toast.error("Please provide a meeting point.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await offerCarpool(eventId, {
        capacity,
        departureTime: new Date(departureTime).toISOString(),
        meetingPoint: meetingPoint.trim(),
        notes: notes.trim() || undefined,
      });
      if (error) {
        toast.error("Something went wrong. Please try again.");
        return;
      }
      if (data?.success) {
        toast.success("Ride offered! A group chat was created for riders.");
        setShowOfferForm(false);
        setCapacity(4);
        setDepartureTime("");
        setMeetingPoint("");
        setNotes("");
        await load();
      } else {
        toast.error(data?.message ?? "Could not offer ride");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const activeCarpools = (carpools ?? []).filter((c) => c.status === "active");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900">
        Transportation / Carpool
      </h2>

      <div className="flex items-start gap-2 border border-amber-500 bg-amber-500/10 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <p className="text-sm text-amber-900">
          <strong>Disclaimer:</strong> Carpooling is arranged between students. CampusConnect is not
          responsible for off-campus transportation safety. Travel at your own risk.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-sm text-slate-600">
          {loading
            ? "Loading rides..."
            : `${activeCarpools.length} ride${activeCarpools.length === 1 ? "" : "s"} offered`}
        </p>
        {user ? (
          <Button
            variant={showOfferForm ? "secondary" : "primary"}
            size="sm"
            onClick={() => setShowOfferForm((v) => !v)}
          >
            <Car className="h-4 w-4" />
            {showOfferForm ? "Close" : "Offer a Ride"}
          </Button>
        ) : null}
      </div>

      {showOfferForm && user && (
        <form
          onSubmit={handleOffer}
          className="flex flex-col gap-3 border-2 border-black bg-white p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="carpool-capacity">Seats available</Label>
              <Input
                id="carpool-capacity"
                type="number"
                min={1}
                max={8}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="carpool-departure">Departure time</Label>
              <Input
                id="carpool-departure"
                type="datetime-local"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="carpool-meeting">Meeting point</Label>
            <Input
              id="carpool-meeting"
              placeholder="e.g. Main gate, North Lot, Library steps"
              value={meetingPoint}
              onChange={(e) => setMeetingPoint(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="carpool-notes">Notes (optional)</Label>
            <Textarea
              id="carpool-notes"
              placeholder="e.g. leaving 10 min early, gas money appreciated, leaving from the dorms"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Offer Ride
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowOfferForm(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse border-2 border-black bg-white/60 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"
            />
          ))}
        </div>
      ) : (carpools ?? []).length === 0 ? (
        <p className="border-2 border-dashed border-black/20 p-4 text-sm font-mono text-slate-500">
          No rides offered yet{user ? " — be the first to offer a ride!" : "."}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(carpools ?? []).map((carpool) => (
            <CarpoolCard
              key={carpool.id}
              carpool={carpool}
              currentUserId={user?.id ?? null}
              busy={busyId === carpool.id}
              onClaim={handleClaim}
              onLeave={handleLeave}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}

      {!user && (
        <p className="text-xs font-mono text-slate-500">Sign in to offer a ride or claim a seat.</p>
      )}
    </div>
  );
}
