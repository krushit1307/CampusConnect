// =============================================================================
// Route: /clubs/:slug/resources
// Issue: #3340 - Develop a 'Club Resource Booking Calendar'
// Description: Lets club members see equipment availability on a calendar
// and drag to request a booking. Club executives (treasurer/president/admin)
// see and act on pending requests.
// =============================================================================

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import format from "date-fns/format";
import getDay from "date-fns/getDay";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Calendar, dateFnsLocalizer, type SlotInfo } from "react-big-calendar";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useItemReservations, type ItemReservation } from "@/hooks/useItemReservations";
import { ResourceBarterMarket } from "@/components/resources/ResourceBarterMarket";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const EXEC_ROLES = ["treasurer", "president", "admin"];

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: ItemReservation;
}

export default function ClubResourcesRoute() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();

  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isExec, setIsExec] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<SlotInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadContext() {
      const { data: clubData, error: clubError } = await supabase
        .from("clubs")
        .select("id, name")
        .eq("slug", slug)
        .single();

      if (clubError || !clubData) {
        navigate("/clubs");
        return;
      }
      setClubId(clubData.id);
      setClubName(clubData.name);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);

      const { data: memberData } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubData.id)
        .eq("user_id", session.user.id)
        .maybeSingle();

      setIsExec(!!memberData && EXEC_ROLES.includes(memberData.role));
    }
    loadContext();
  }, [slug, navigate]);

  const { items, reservations, isLoading, requestReservation, updateReservationStatus } =
    useItemReservations(clubId ?? undefined);

  const calendarEvents: CalendarEvent[] = useMemo(
    () =>
      reservations
        .filter((r) => !selectedItemId || r.item_id === selectedItemId)
        .map((r) => ({
          id: r.id,
          title: `${r.inventory_items?.name ?? "Item"} — ${r.status === "pending" ? "Requested" : "Booked"}`,
          start: new Date(r.start_time),
          end: new Date(r.end_time),
          resource: r,
        })),
    [reservations, selectedItemId],
  );

  const pendingApprovals = reservations.filter((r) => r.status === "pending");

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    if (!selectedItemId) {
      toast.error("Pick an item to book first.");
      return;
    }
    setPendingSlot(slotInfo);
  };

  const confirmRequest = async () => {
    if (!pendingSlot || !selectedItemId || !userId) return;
    setIsSubmitting(true);
    try {
      await requestReservation(
        selectedItemId,
        userId,
        pendingSlot.start as Date,
        pendingSlot.end as Date,
      );
      toast.success("Booking requested — the treasurer will review it.");
      setPendingSlot(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That slot is already booked.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecision = async (reservationId: string, status: "approved" | "rejected") => {
    try {
      await updateReservationStatus(reservationId, status);
      toast.success(status === "approved" ? "Reservation approved." : "Reservation rejected.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the reservation.");
    }
  };

  if (!clubId || isLoading) {
    return (
      <SiteShell>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link
          to={`/clubs/${slug}`}
          className="inline-flex items-center gap-2 font-mono text-sm text-blue-600 hover:underline mb-4"
        >
          <ArrowLeft size={16} /> Back to {clubName}
        </Link>

        <h1 className="font-display text-3xl font-bold uppercase mb-6">Resource Booking</h1>

        <ResourceBarterMarket clubId={clubId} />

        <div className="mb-6 flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItemId(item.id)}
              className={`neu-border px-4 py-2 font-mono text-sm font-bold uppercase transition-all ${
                selectedItemId === item.id
                  ? "bg-black text-white"
                  : "bg-white text-black hover:bg-gray-50"
              }`}
            >
              {item.name}
            </button>
          ))}
          {items.length === 0 && (
            <p className="font-mono text-sm text-black/50">
              This club has no bookable equipment yet.
            </p>
          )}
        </div>

        <div className="neu-border h-[600px] w-full bg-white p-4">
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            selectable={!!selectedItemId}
            onSelectSlot={handleSelectSlot}
            style={{ height: "100%" }}
            eventPropGetter={(event: CalendarEvent) => ({
              className:
                event.resource.status === "pending"
                  ? "calendar-event-social"
                  : "calendar-event-academic",
            })}
          />
        </div>

        {pendingSlot && (
          <div className="neu-border mt-4 bg-cream p-4 flex items-center justify-between">
            <p className="font-mono text-sm">
              Request {items.find((i) => i.id === selectedItemId)?.name} from{" "}
              {format(pendingSlot.start as Date, "PPP p")} to{" "}
              {format(pendingSlot.end as Date, "PPP p")}?
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmRequest} disabled={isSubmitting}>
                Request Booking
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPendingSlot(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isExec && pendingApprovals.length > 0 && (
          <div className="neu-border mt-8 bg-white p-6">
            <h2 className="font-display text-xl font-bold uppercase mb-4">
              Pending Approvals
            </h2>
            <div className="space-y-3">
              {pendingApprovals.map((r) => (
                <div
                  key={r.id}
                  className="neu-border flex items-center justify-between p-3 font-mono text-sm"
                >
                  <span>
                    {r.profiles?.full_name ?? "A member"} wants{" "}
                    {r.inventory_items?.name ?? "an item"} ·{" "}
                    {format(new Date(r.start_time), "PP p")} –{" "}
                    {format(new Date(r.end_time), "p")}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleDecision(r.id, "approved")}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDecision(r.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SiteShell>
  );
}