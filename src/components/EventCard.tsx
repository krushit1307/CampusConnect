import { formatDate } from "@/lib/utils";
import { FormEvent, useState } from "react";
import { Check, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  banner_url?: string | null;
  clubs: { name: string } | { name: string }[] | null;
  event_rsvps: { id: string; user_id: string }[] | null;
}

interface EventCardProps {
  event: Event;
  index: number;
  user: { id: string } | null;
  onRsvpToggle: (eventId: string, hasRsvpd: boolean) => void;
  isRsvpPending: boolean;
}

export function EventCard({ event, index, user, onRsvpToggle, isRsvpPending }: EventCardProps) {
  const club = Array.isArray(event.clubs) ? event.clubs[0] : event.clubs;
  const rsvps = Array.isArray(event.event_rsvps) ? event.event_rsvps : [];
  const hasRsvpd = user ? rsvps.some((rsvp) => rsvp.user_id === user.id) : false;
  const colors = ["bg-lime", "bg-sky", "bg-peach", "bg-lavender"];

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [dietaryPreference, setDietaryPreference] = useState("");
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setStudentId("");
    setDietaryPreference("");
    setIsFormOpen(false);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#event-${event.id}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleRsvpClick = () => {
    if (!user) {
      toast.error("Please log in to RSVP");
      return;
    }

    if (hasRsvpd) {
      setConfirmOpen(true);
      return;
    }

    setIsFormOpen(true);
  };

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();

    const form = formEvent.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    onRsvpToggle(event.id, false);
    resetForm();
  };
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <article id={`event-${event.id}`} className={`neu-border p-5 ${colors[index % colors.length]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-xs font-bold uppercase tracking-wider">
          {event.event_date ? formatDate(event.event_date).split(" at ")[0].toUpperCase() : "TBA"}
        </p>
        <button
          type="button"
          onClick={handleShare}
          aria-label="Copy event link"
          className="neu-border neu-press grid h-8 w-8 shrink-0 place-items-center bg-white"
        >
          {copied ? (
            <Check aria-hidden="true" size={14} strokeWidth={3} />
          ) : (
            <Share2 aria-hidden="true" size={14} strokeWidth={3} />
          )}
        </button>
      </div>

      <p className="mt-3 font-mono text-xs font-bold uppercase">Event</p>
      <h2 className="mt-1 text-2xl font-black">{event.title}</h2>
      <p className="mt-1 font-mono text-sm font-bold">{club?.name}</p>

      {event.description ? <p className="mt-4 text-sm leading-6">{event.description}</p> : null}

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="font-mono text-xs font-bold uppercase">Date &amp; Time</dt>
          <dd className="mt-1 text-sm">
            {event.event_date ? formatDate(event.event_date) : "TBA"}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-xs font-bold uppercase">Venue</dt>
          <dd className="mt-1 text-sm">{event.location || "TBA"}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs font-bold uppercase">Attendees</dt>
          <dd className="mt-1 text-sm">{rsvps.length} RSVP&apos;d</dd>
        </div>
      </dl>

      {isFormOpen && !hasRsvpd ? (
        <form className="neu-border mt-5 bg-white p-4" onSubmit={handleSubmit} noValidate={false}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-black">Complete your RSVP</h3>
              <p className="mt-1 text-sm">Required fields must be completed before submitting.</p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="neu-border grid h-9 w-9 shrink-0 place-items-center bg-cream"
              aria-label="Close RSVP form"
            >
              <X aria-hidden="true" size={18} strokeWidth={3} />
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="font-mono text-xs font-bold uppercase">
                Student ID{" "}
                <span className="text-destructive ml-1" aria-hidden="true">
                  *
                </span>
              </span>
              <input
                type="text"
                name="studentId"
                value={studentId}
                onChange={(inputEvent) => setStudentId(inputEvent.target.value)}
                required
                minLength={3}
                maxLength={30}
                autoComplete="off"
                className="neu-border mt-2 w-full bg-cream px-3 py-2 outline-none focus:ring-2 focus:ring-black"
                placeholder="Enter your student ID"
              />
            </label>

            <label className="block">
              <span className="font-mono text-xs font-bold uppercase">
                Dietary preference{" "}
                <span className="text-destructive ml-1" aria-hidden="true">
                  *
                </span>
              </span>
              <select
                name="dietaryPreference"
                value={dietaryPreference}
                onChange={(selectEvent) => setDietaryPreference(selectEvent.target.value)}
                required
                className="neu-border mt-2 w-full bg-cream px-3 py-2 outline-none focus:ring-2 focus:ring-black"
              >
                <option value="" disabled>
                  Select an option
                </option>
                <option value="none">No preference</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="halal">Halal</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isRsvpPending}
              className="neu-border bg-black px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-cream disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRsvpPending ? "Submitting..." : "Confirm RSVP"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="neu-border bg-white px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {!isFormOpen || hasRsvpd ? (
        <button
          type="button"
          onClick={handleRsvpClick}
          disabled={isRsvpPending}
          className={`neu-border mt-5 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
            hasRsvpd ? "bg-lime text-black" : "bg-black text-cream"
          }`}
        >
          {isRsvpPending ? "Updating..." : hasRsvpd ? "RSVP'd ✓" : "RSVP →"}
        </button>
      ) : null}
      <div className="mt-4 flex gap-2">
        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="neu-border px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-[#1DA1F2] hover:text-white transition-colors"
        >
          Twitter
        </a>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="neu-border px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-[#0A66C2] hover:text-white transition-colors"
        >
          LinkedIn
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Check out this event: ${event.title} - ${window.location.href}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="neu-border px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-[#25D366] hover:text-white transition-colors"
        >
          WhatsApp
        </a>
      </div>
    </article>
  );
}
