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

export default function EventDetailsPage() {
  const { eventId = "" } = useParams();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [copied, setCopied] = useState(false);
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
        .from("club_analytics_view")
        .select(
          `
          id, title, description, event_date, start_date, end_date, location, banner_url,
          clubs (name, slug),
          event_rsvps (id, user_id),
          attendee_count
        `,
        )
        .eq("id", eventId)
        .single();

      if (error) {
        // Fallback to mock data in development if db fails or doesn't exist
        if (import.meta.env.DEV && eventId.startsWith("mock-")) {
          return {
            id: eventId,
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
            attendee_count: eventId === "mock-1" ? 1 : 0,
          };
        }
        throw error;
      }
      return data;
    },
  });

  const toggleRsvp = useMutation({
    mutationFn: async ({ eventId, hasRsvpd }: { eventId: string; hasRsvpd: boolean }) => {
      if (!user) throw new Error("Please log in to RSVP");
      if (eventId.startsWith("mock-")) {
        console.log(`[CampusConnect] Mock RSVP toggled for event: ${eventId}`);
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

  const handleConfirmCancel = () => {
    toggleRsvp.mutate({ eventId: event.id, hasRsvpd: true });
    setConfirmOpen(false);
  };

  return (
    <SiteShell>
      {/* Top navigation header */}
      <nav className="border-b-2 border-black bg-white px-4 py-4 md:px-6">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/events"
            className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider hover:underline"
          >
            <ArrowLeft size={14} /> Back to Events
          </Link>
        </div>
      </nav>

      {/* Banner / Hero image */}
      <section className="border-b-2 border-black bg-peach/30 px-4 py-8 md:px-6 md:py-12">
        <div className="mx-auto max-w-4xl">
          {event.banner_url ? (
            <OptimizedImage
              src={event.banner_url}
              alt={`${event.title} event banner`}
              className="neu-border h-48 w-full object-cover md:h-80"
              width={896}
              height={320}
              responsiveWidths={[448, 672, 896, 1344]}
              sizes="(max-width: 768px) calc(100vw - 2rem), 896px"
              priority
              fallback={
                <div className="neu-border flex h-48 w-full items-center justify-center bg-peach md:h-80">
                  <span className="font-display text-2xl font-black uppercase text-black/50">
                    {event.title}
                  </span>
                </div>
              }
            />
          ) : (
            <div className="neu-border flex h-48 w-full items-center justify-center bg-peach md:h-80">
              <span className="font-display text-2xl font-black uppercase text-black/50">
                {event.title}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Details Container */}
      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl neu-border bg-white p-6 md:p-8">
          {/* Eyebrow */}
          <span className="neu-border bg-cream px-2 py-1 font-mono text-[10px] font-bold uppercase">
            Event Details
          </span>

          {/* Title */}
          <h1 className="mt-4 text-3xl font-black md:text-5xl">{event.title}</h1>

          {/* Organizer / Club link */}
          {club && (
            <p className="mt-3 font-mono text-sm font-bold">
              Organized by:{" "}
              <Link to={`/clubs/${club.slug}`} className="underline hover:text-black/70">
                {club.name}
              </Link>
            </p>
          )}

          {/* Meta Data Grid */}
          <div className="mt-8 grid gap-6 border-y-2 border-black py-6 sm:grid-cols-3">
            <div className="flex gap-3">
              <Calendar className="mt-1 h-5 w-5 shrink-0 text-black/60" />
              <div>
                <dt className="font-mono text-xs font-bold uppercase text-black/50">
                  Date &amp; Time
                </dt>
                <dd className="mt-1 text-sm font-bold">{formatEventDateRange(event)}</dd>
              </div>
            </div>

            <div className="flex gap-3">
              <MapPin className="mt-1 h-5 w-5 shrink-0 text-black/60" />
              <div>
                <dt className="font-mono text-xs font-bold uppercase text-black/50">Venue</dt>
                <dd className="mt-1 text-sm font-bold">{event.location || "TBA"}</dd>
              </div>
            </div>

            <div className="flex gap-3">
              <Users className="mt-1 h-5 w-5 shrink-0 text-black/60" />
              <div>
                <dt className="font-mono text-xs font-bold uppercase text-black/50">Attendees</dt>
                <dd className="mt-1 text-sm font-bold">{event.attendee_count ?? 0} RSVP&apos;d</dd>
              </div>
            </div>
          </div>

          {/* Action buttons (RSVP / Copy Link) */}
          <div className="mt-8 flex flex-wrap items-center gap-4 border-b-2 border-black pb-8">
            <button
              onClick={handleRsvpClick}
              disabled={toggleRsvp.isPending}
              className={`neu-border px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                hasRsvpd ? "bg-lime text-black" : "bg-black text-cream"
              }`}
            >
              {toggleRsvp.isPending ? "Updating..." : hasRsvpd ? "RSVP'd ✓" : "RSVP →"}
            </button>

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

            {hasRsvpd && googleCalendarUrl && (
              <a
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="neu-border bg-white px-5 py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <Calendar aria-hidden="true" size={14} strokeWidth={3} />
                Add to Google Calendar
              </a>
            )}
          </div>

          {/* Description */}
          <div className="mt-8">
            <h2 className="font-display text-xl font-bold uppercase tracking-tight">
              About the Event
            </h2>
            {event.description ? (
              <p className="mt-4 text-base leading-7 text-black/80 whitespace-pre-line">
                {event.description}
              </p>
            ) : (
              <p className="mt-4 font-mono text-sm italic text-black/40">
                No description provided for this event.
              </p>
            )}
          </div>

          {/* Map Embed */}
          {event.location && event.location.toLowerCase() !== "online" && (
            <div className="mt-8">
              <h2 className="font-display text-xl font-bold uppercase tracking-tight">Location</h2>
              {!coordsCheck.isValid ? (
                <div className="neu-border mt-4 bg-peach/20 p-5 flex items-start gap-4">
                  <div className="p-2 bg-white border-2 border-black rounded-none shrink-0 text-[#e53935]">
                    <MapPinOff className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-black mb-1">
                      Unable to load map preview
                    </h3>
                    <p className="font-mono text-xs text-gray-700 leading-relaxed mb-3">
                      The coordinates provided (<code>{event.location}</code>) are invalid. Latitude
                      must be between -90 and 90, and Longitude between -180 and 180.
                    </p>
                    <a
                      href={`https://www.google.com/maps/search/?q=${encodeURIComponent(event.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs font-bold underline hover:no-underline"
                    >
                      Search location on Google Maps anyway ↗
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <iframe
                    className="neu-border mt-4 w-full"
                    height="300"
                    loading="lazy"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(event.location)}&output=embed`}
                    title="Event location map"
                  />
                  <a
                    href={`https://www.google.com/maps/search/?q=${encodeURIComponent(event.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block font-mono text-xs font-bold underline"
                  >
                    View larger map ↗
                  </a>
                </>
              )}
            </div>
          )}

          {/* Social Share Buttons */}
          <div className="mt-10 border-t-2 border-black pt-6">
            <h3 className="font-mono text-xs font-bold uppercase text-black/50">
              Share with Friends
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="neu-border px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-[#1DA1F2] hover:text-white transition-colors"
              >
                Twitter
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="neu-border px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-[#0A66C2] hover:text-white transition-colors"
              >
                LinkedIn
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Check out this event: ${event.title} - ${window.location.href}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="neu-border px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-[#25D366] hover:text-white transition-colors"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

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
