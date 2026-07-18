import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { SiteShell } from "@/components/site/SiteShell";
import { SkeletonEventDetails } from "@/components/events/SkeletonEventDetails";
import { formatDate, getGoogleCalendarUrl } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, Calendar, Check, Link as LinkIcon, MapPin, Share2, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";

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
        .from("events")
        .select(
          `
          id, title, description, event_date, location, banner_url,
          clubs (name, slug),
          event_rsvps (id, user_id)
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
            location:
              eventId === "mock-1"
                ? "Main Auditorium"
                : eventId === "mock-2"
                  ? "Art Studio 3"
                  : "Student Center",
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

  const googleCalendarUrl = getGoogleCalendarUrl({
    title: event.title,
    description: event.description || "",
    event_date: event.event_date || "",
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

      {/* Hero Section */}
      <section className="relative w-full border-b-2 border-black bg-peach/30 overflow-hidden">
        {event.banner_url ? (
          <div className="absolute inset-0">
            <img
              src={event.banner_url}
              alt={event.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/50" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-peach via-pink-200 to-lime/40" />
        )}

        <div className="relative mx-auto max-w-4xl px-4 py-16 md:px-6 md:py-24 flex flex-col justify-end min-h-[50vh] md:min-h-[60vh]">
          <div className="mb-4">
            <span className="neu-border bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-black inline-block">
              Event Details
            </span>
          </div>

          <h1
            className={`text-4xl md:text-6xl font-black tracking-tight ${event.banner_url ? "text-white" : "text-black"}`}
          >
            {event.title}
          </h1>

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
            className={`mt-8 flex flex-wrap gap-4 sm:gap-8 font-mono text-sm font-bold ${event.banner_url ? "text-white" : "text-black"}`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <span>{event.event_date ? formatDate(event.event_date) : "TBA"}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              <span>{event.location || "TBA"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span>{rsvps.length} RSVP&apos;d</span>
            </div>
          </div>

          <div className="mt-8 hidden md:flex items-center gap-4">
            <button
              onClick={handleRsvpClick}
              disabled={toggleRsvp.isPending}
              className={`neu-border px-8 py-4 font-mono text-base font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                hasRsvpd ? "bg-lime text-black" : "bg-black text-cream"
              }`}
            >
              {toggleRsvp.isPending ? "Updating..." : hasRsvpd ? "RSVP'd ✓" : "RSVP NOW"}
            </button>
            <span
              className={`font-mono text-sm font-bold ${event.banner_url ? "text-white/80" : "text-black/60"}`}
            >
              {rsvps.length} people going
            </span>
          </div>
        </div>
      </section>

      {/* Details Container */}
      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl neu-border bg-white p-6 md:p-8">
          {/* Metadata moved to hero section */}

          {/* Action buttons (RSVP / Copy Link) */}
          <div className="mt-8 flex flex-wrap items-center gap-4 border-b-2 border-black pb-8">
            {/* Primary RSVP moved to hero section */}

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

      {/* Sticky Mobile RSVP Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t-2 border-black bg-white p-4 pb-6 shadow-lg md:hidden">
        <div className="flex flex-col">
          <span className="font-mono text-xs font-bold text-black/60 uppercase">
            {rsvps.length} going
          </span>
        </div>
        <button
          onClick={handleRsvpClick}
          disabled={toggleRsvp.isPending}
          className={`neu-border px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
            hasRsvpd ? "bg-lime text-black" : "bg-black text-cream"
          }`}
        >
          {toggleRsvp.isPending ? "Updating..." : hasRsvpd ? "RSVP'd ✓" : "RSVP NOW"}
        </button>
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
