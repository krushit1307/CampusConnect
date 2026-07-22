import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { SiteShell } from "@/components/site/SiteShell";
import { SkeletonEventDetails } from "@/components/events/SkeletonEventDetails";
import { formatEventDateRange, getGoogleCalendarUrl } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  Download,
  Link as LinkIcon,
  MapPin,
  MapPinOff,
  Share2,
  Users,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { OptimizedImage } from "@/components/media/OptimizedImage";
import { parseCoordinates } from "@/lib/eventUtils";
import { EventMap } from "@/components/EventMap";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

function rsvpRowsToCsv(rows: { name: string; email: string; rsvp_date: string; status: string }[]) {
  const headers = ["User Name", "Email", "RSVP Date", "Status"];
  const escape = (val: string) => {
    const str = String(val ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.name, r.email, r.rsvp_date, r.status].map(escape).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function EventDetailsPage() {
  const { eventId = "" } = useParams();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [copied, setCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const {
    data: event,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          `
          id, title, description, event_date, start_date, end_date, location, banner_url, created_by, max_attendees,
          clubs (name, slug),
          event_rsvps (id, user_id),
          event_waitlist (id, user_id, created_at)
        `,
        )
        .eq("id", eventId)
        .single();

      if (error) {
        // Fallback to mock data in development if db fails or doesn't exist
        if (import.meta.env.DEV && eventId.startsWith("mock-")) {
          return {
            id: eventId,
            // Mock data has no real owner; use a placeholder so this branch's
            // type matches the real Supabase row (which always has
            // created_by) instead of silently omitting the field.
            created_by: "mock-user-1",
            title:
              eventId === "mock-1"
                ? "Hackathon 2024"
                : eventId === "mock-2"
                  ? "Watercolor Workshop"
                  : "Open Mic Night",
            description:
              eventId === "mock-1"
                ? "Annual college hackathon. Build something awesome in 24 hours!"
                : eventId === "mock-2"
                  ? "Learn the basics of watercolor painting with live demonstrations."
                  : "Showcase your music talent or just come to enjoy the acoustic performances.",
            event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
            ).toISOString(),
            location:
              eventId === "mock-1"
                ? "Main Auditorium, Thapar Institute of Engineering and Technology, Patiala, Punjab"
                : eventId === "mock-2"
                  ? "Art Block, Jawaharlal Nehru University, New Delhi"
                  : "Student Activity Centre, IIT Bombay, Powai, Mumbai",
            banner_url: null as string | null,
            max_attendees: eventId === "mock-1" ? 1 : null,
            clubs: [
              {
                name:
                  eventId === "mock-1"
                    ? "Tech Club"
                    : eventId === "mock-2"
                      ? "Art & Design"
                      : "Music Society",
                slug:
                  eventId === "mock-1"
                    ? "tech-club"
                    : eventId === "mock-2"
                      ? "art-design"
                      : "music-society",
              },
            ],
            event_rsvps: eventId === "mock-1" ? [{ id: "rsvp-1", user_id: "user-1" }] : [],
            event_waitlist: [] as { id: string; user_id: string; created_at: string }[],
            attendee_count: eventId === "mock-1" ? 1 : 0,
          };
        }
        throw error;
      }
      return data;
    },
  });

  const toggleWaitlist = useMutation({
    mutationFn: async ({ isOnWaitlist }: { isOnWaitlist: boolean }) => {
      if (!user) throw new Error("Please log in to join waitlist");
      if (eventId.startsWith("mock-")) {
        return;
      }

      if (isOnWaitlist) {
        const { error } = await supabase
          .from("event_waitlist")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_waitlist")
          .insert({ event_id: eventId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update waitlist status. Please try again.");
    },
  });

  const toggleRsvp = useMutation({
    mutationFn: async ({ eventId, hasRsvpd }: { eventId: string; hasRsvpd: boolean }) => {
      if (!user) throw new Error("Please log in to RSVP");
      if (eventId.startsWith("mock-")) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { error } = await supabase.functions.invoke("toggle-rsvp", {
        body: { eventId, hasRsvpd },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update RSVP. Please try again.");
    },
  });

  const exportCsv = useMutation({
    mutationFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("export-event-rsvps", {
        body: { eventId: event!.id },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      return data as {
        rows: { name: string; email: string; rsvp_date: string; status: string }[];
      };
    },
    onSuccess: (data) => {
      const csv = rsvpRowsToCsv(data.rows);
      const safeTitle = (event?.title ?? "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      downloadCsv(csv, `${safeTitle}-rsvps.csv`);
      toast.success("RSVP list exported.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to export RSVP list.");
    },
  });

  const isOrganizer = user && event?.created_by === user.id;

  if (isLoading) {
    return <SkeletonEventDetails />;
  }

  if (!event) {
    return (
      <SiteShell>
        <section className="bg-cream px-4 py-20 md:px-6">
          <div className="mx-auto max-w-md neu-border bg-white p-8 text-center">
            <h1 className="text-3xl font-black">Event Not Found</h1>
            <p className="mt-4 font-mono text-sm leading-6">
              The event you are looking for does not exist, has been removed, or the link is
              incorrect.
            </p>
            <Link
              to="/events"
              className="neu-press mt-6 inline-flex items-center gap-2 border-2 border-black bg-lime px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider"
            >
              <ArrowLeft size={14} /> Back to Events
            </Link>
          </div>
        </section>
      </SiteShell>
    );
  }

  const rsvps = Array.isArray(event.event_rsvps) ? event.event_rsvps : [];
  const hasRsvpd = user ? rsvps.some((r) => r.user_id === user.id) : false;

  const rawWaitlist = (event as Record<string, unknown>).event_waitlist;
  const waitlist = Array.isArray(rawWaitlist)
    ? [...(rawWaitlist as { id: string; user_id: string; created_at?: string }[])].sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
      )
    : [];
  const isOnWaitlist = user ? waitlist.some((w) => w.user_id === user.id) : false;
  const waitlistPosition =
    user && isOnWaitlist ? waitlist.findIndex((w) => w.user_id === user.id) + 1 : 0;

  const club = event.clubs ? (Array.isArray(event.clubs) ? event.clubs[0] : event.clubs) : null;
  const coordsCheck = event.location
    ? parseCoordinates(event.location)
    : { isCoordinates: false, isValid: true };

  const googleCalendarUrl = getGoogleCalendarUrl({
    title: event.title,
    description: event.description || "",
    event_date: event.event_date || "",
    start_date: event.start_date,
    end_date: event.end_date,
    location: event.location || "",
  });

  const handleRsvpClick = () => {
    if (!user) {
      toast.error("Please log in to RSVP");
      return;
    }
    if (hasRsvpd) {
      setConfirmOpen(true);
      return;
    }
    toggleRsvp.mutate({ eventId: event.id, hasRsvpd: false });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Event link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link.");
    }
  };

  const handleCopyEventId = async () => {
    try {
      await navigator.clipboard.writeText(event.id);
      setIdCopied(true);
      toast.success("Event ID copied to clipboard!");
      setTimeout(() => setIdCopied(false), 2000);
    } catch {
      toast.error("Failed to copy event ID.");
    }
  };

  const handleConfirmCancel = () => {
    toggleRsvp.mutate({ eventId: event.id, hasRsvpd: true });
    setConfirmOpen(false);
  };

  const attendeeCount =
    ((event as Record<string, unknown>).attendee_count as number) ?? rsvps.length;
  const maxAttendees = (event as Record<string, unknown>).max_attendees as
    number | null | undefined;
  const isAtCapacity =
    maxAttendees !== null &&
    maxAttendees !== undefined &&
    maxAttendees > 0 &&
    attendeeCount >= maxAttendees;

  return (
    <SiteShell>
      {/* Breadcrumb nav — replaces the old back-link bar */}
      <nav className="border-b-2 border-black bg-white px-4 py-4 md:px-6" aria-label="Breadcrumb">
        <div className="mx-auto max-w-4xl">
          {/* Mobile: simple back link */}
          <Link
            to="/events"
            className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider hover:underline sm:hidden"
          >
            <ArrowLeft size={14} /> Events
          </Link>
          {/* sm+: full breadcrumb */}
          <Breadcrumb className="hidden sm:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/" className="font-mono text-xs font-bold uppercase">
                    Home
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/events" className="font-mono text-xs font-bold uppercase">
                    Events
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-mono text-xs font-bold uppercase">
                  {event.title}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative w-full overflow-hidden border-b-2 border-black bg-peach/30">
        {event.banner_url ? (
          <div className="absolute inset-0">
            <OptimizedImage
              src={event.banner_url}
              alt={`${event.title} event banner`}
              className="h-full w-full object-cover"
              width={1344}
              height={700}
              responsiveWidths={[448, 672, 896, 1344]}
              sizes="100vw"
              priority
              fallback={
                <div className="h-full w-full bg-gradient-to-br from-peach via-pink-200 to-lime/40" />
              }
            />
            <div className="absolute inset-0 bg-black/50" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-peach via-pink-200 to-lime/40" />
        )}

        <div className="relative mx-auto flex min-h-[50vh] max-w-4xl flex-col justify-end px-4 py-16 md:min-h-[60vh] md:px-6 md:py-24">
          <div className="mb-4">
            <span className="neu-border inline-block bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-black">
              Event Details
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1
              className={`text-4xl font-black tracking-tight md:text-6xl ${event.banner_url ? "text-white" : "text-black"}`}
            >
              {event.title}
            </h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleCopyEventId}
                    variant="outline"
                    size="icon"
                    className="neu-border h-8 w-8 shrink-0 bg-white text-black transition-all duration-300 hover:scale-105 active:scale-95"
                    aria-label="Copy Event ID"
                  >
                    {idCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy Event ID</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {club && (
            <p
              className={`mt-4 font-mono text-base font-bold ${event.banner_url ? "text-white/90" : "text-black/80"}`}
            >
              Organized by:{" "}
              <Link to={`/clubs/${club.slug}`} className="underline hover:opacity-80">
                {club.name}
              </Link>
            </p>
          )}

          <div
            className={`mt-8 flex flex-wrap gap-4 font-mono text-sm font-bold sm:gap-8 ${event.banner_url ? "text-white" : "text-black"}`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <span>{formatEventDateRange(event)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              <span>{event.location || "TBA"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span>{attendeeCount} RSVP&apos;d</span>
            </div>
          </div>

          <div className="mt-8 hidden items-center gap-4 md:flex">
            {hasRsvpd ? (
              <Button
                onClick={handleRsvpClick}
                disabled={toggleRsvp.isPending}
                variant="secondary"
                size="lg"
              >
                {toggleRsvp.isPending ? "Updating..." : "RSVP'd ✓"}
              </Button>
            ) : isAtCapacity ? (
              <div className="flex flex-col gap-1">
                <Button
                  onClick={() => {
                    if (!user) {
                      toast.error("Please log in to join waitlist");
                      return;
                    }
                    toggleWaitlist.mutate({ isOnWaitlist });
                  }}
                  disabled={toggleWaitlist.isPending}
                  variant={isOnWaitlist ? "secondary" : "primary"}
                  size="lg"
                >
                  {toggleWaitlist.isPending
                    ? "Updating..."
                    : isOnWaitlist
                      ? "On Waitlist ✓"
                      : "Join Waitlist"}
                </Button>
                {isOnWaitlist && waitlistPosition > 0 && (
                  <span
                    className={`font-mono text-xs font-bold ${event.banner_url ? "text-white" : "text-black"}`}
                  >
                    You are #{waitlistPosition} on the waitlist
                  </span>
                )}
              </div>
            ) : (
              <Button
                onClick={handleRsvpClick}
                disabled={toggleRsvp.isPending}
                variant="primary"
                size="lg"
              >
                {toggleRsvp.isPending ? "Updating..." : "RSVP NOW"}
              </Button>
            )}
            <span
              className={`font-mono text-sm font-bold ${event.banner_url ? "text-white/80" : "text-black/60"}`}
            >
              {attendeeCount} {maxAttendees ? `/ ${maxAttendees}` : ""} people going
              {isAtCapacity && !hasRsvpd && " (At Capacity)"}
            </span>
          </div>
        </div>
      </section>

      {/* Details Container */}
      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl neu-border bg-white p-6 md:p-8">
          {/* Action buttons (Copy Link / Add to Calendar) */}
          <div className="flex flex-wrap items-center gap-4 border-b-2 border-black pb-8">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    className="neu-border neu-press h-12 bg-white px-5 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    {copied ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <LinkIcon className="mr-2 h-4 w-4" />
                    )}
                    {copied ? "Copied" : "Copy Link"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy Event Link</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {isOrganizer && (
              <Button
                onClick={() => exportCsv.mutate()}
                disabled={exportCsv.isPending}
                variant="outline"
                className="neu-border neu-press h-12 bg-white px-5 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <Download className="mr-2 h-4 w-4" />
                {exportCsv.isPending ? "Exporting..." : "Export CSV"}
              </Button>
            )}

            {hasRsvpd && googleCalendarUrl && (
              <a
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="neu-border flex items-center gap-2 bg-white px-5 py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <Calendar aria-hidden="true" size={14} strokeWidth={3} />
                Add to Google Calendar
              </a>
            )}
          </div>

          {/* Description */}
          <div className="mt-8">
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900">
              About the Event
            </h2>
            {event.description ? (
              <p className="mt-4 whitespace-pre-line text-base leading-7 text-black/80">
                {event.description}
              </p>
            ) : (
              <p className="mt-4 font-mono text-sm italic text-black/40">
                No description provided for this event.
              </p>
            )}
          </div>

          {/* Interactive Map */}
          {event.location && event.location.toLowerCase() !== "online" && (
            <div className="mt-8">
              <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900">
                Location
              </h2>
              {coordsCheck.isCoordinates &&
              coordsCheck.isValid &&
              coordsCheck.lat != null &&
              coordsCheck.lng != null ? (
                <>
                  <EventMap
                    lat={coordsCheck.lat}
                    lng={coordsCheck.lng}
                    locationName={event.location}
                  />
                  <a
                    href={`https://www.google.com/maps/search/?q=${encodeURIComponent(event.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block font-mono text-xs font-bold underline text-blue-500"
                  >
                    Open in Google Maps ↗
                  </a>
                </>
              ) : coordsCheck.isCoordinates && !coordsCheck.isValid ? (
                <div className="neu-border mt-4 flex items-start gap-4 bg-peach/20 p-5">
                  <div className="shrink-0 rounded-none border-2 border-black bg-white p-2 text-[#e53935]">
                    <MapPinOff className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="mb-1 font-display text-lg font-bold text-black">
                      Unable to load map preview
                    </h3>
                    <p className="mb-3 font-mono text-xs leading-relaxed text-gray-700">
                      The coordinates provided (<code>{event.location}</code>) are invalid. Latitude
                      must be between -90 and 90, and Longitude between -180 and 180.
                    </p>
                    <a
                      href={`https://www.google.com/maps/search/?q=${encodeURIComponent(event.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs font-bold underline hover:no-underline text-black"
                    >
                      Search location on Google Maps anyway ↗
                    </a>
                  </div>
                </div>
              ) : (
                <a
                  href={`https://www.google.com/maps/search/?q=${encodeURIComponent(event.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="neu-border mt-4 inline-flex items-center gap-2 bg-white px-5 py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  <MapPin className="h-4 w-4" />
                  Open "{event.location}" in Google Maps ↗
                </a>
              )}
            </div>
          )}

          {/* Social Share Buttons */}
          <div className="mt-10 border-t-2 border-black pt-6">
            <h3 className="font-mono text-xs font-bold uppercase text-blue-900">
              Share with Friends
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="neu-border px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-[#1DA1F2] hover:text-white transition-colors text-black"
              >
                Twitter
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="neu-border px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-[#0A66C2] hover:text-white transition-colors text-black"
              >
                LinkedIn
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Check out this event: ${event.title} - ${window.location.href}`)}`}
                target="_blank"
                rel="noopener noreferrer"

                className="neu-border px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-[#25D366] hover:text-white transition-colors text-black"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Mobile RSVP Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t-2 border-black bg-white p-4 pb-6 shadow-lg md:hidden">
        <div className="flex flex-col">
          <span className="font-mono text-xs font-bold uppercase text-black/60">
            {attendeeCount} {maxAttendees ? `/ ${maxAttendees}` : ""} going
          </span>
          {isOnWaitlist && waitlistPosition > 0 && (
            <span className="font-mono text-[10px] font-bold text-amber-700">
              Waitlist position: #{waitlistPosition}
            </span>
          )}
        </div>
        {hasRsvpd ? (
          <Button onClick={handleRsvpClick} disabled={toggleRsvp.isPending} variant="secondary">
            {toggleRsvp.isPending ? "Updating..." : "RSVP'd ✓"}
          </Button>
        ) : isAtCapacity ? (
          <Button
            onClick={() => {
              if (!user) {
                toast.error("Please log in to join waitlist");
                return;
              }
              toggleWaitlist.mutate({ isOnWaitlist });
            }}
            disabled={toggleWaitlist.isPending}
            variant={isOnWaitlist ? "secondary" : "primary"}
          >
            {toggleWaitlist.isPending
              ? "Updating..."
              : isOnWaitlist
                ? "On Waitlist ✓"
                : "Join Waitlist"}
          </Button>
        ) : (
          <Button onClick={handleRsvpClick} disabled={toggleRsvp.isPending} variant="primary">
            {toggleRsvp.isPending ? "Updating..." : "RSVP NOW"}
          </Button>
        )}
      </div>

      {/* RSVP Cancel Confirmation Modal */}
      <ConfirmModal
        open={confirmOpen}
        title="Cancel RSVP"
        description="Are you sure you want to cancel your RSVP for this event? Your spot will be released."
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </SiteShell>
  );
}
