import React from "react";
import { Calendar, Check, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { getIcsContent } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EventRSVPButton } from "@/components/EventRSVPButton";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { TicketDialog } from "@/components/ui/ticket-modal";
import { ShareMenu } from "@/components/ui/ShareMenu";
import { useEventCardContext } from "./EventCardContext";

export function EventCardActions() {
  const {
    event,
    user,
    hasRsvpd,
    myRsvp,
    isRsvpPending,
    googleCalendarUrl,
    handleRsvpToggleClick,
    handleCopyLink,
    copied,
    confirmOpen,
    setConfirmOpen,
    ticketOpen,
    setTicketOpen,
    onRsvpToggle,
  } = useEventCardContext();

  const handleDownloadIcs = () => {
    const icsContent = getIcsContent({
      title: event.title,
      description: event.description,
      event_date: event.event_date,
      start_date: event.start_date,
      end_date: event.end_date,
      location: event.location,
    });

    if (!icsContent) {
      toast.error("Failed to generate calendar file");
      return;
    }

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${event.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <EventRSVPButton
          eventId={event.id}
          user={user}
          hasRsvpd={hasRsvpd}
          isPending={isRsvpPending}
          onToggle={handleRsvpToggleClick}
        />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleCopyLink}
                variant="outline"
                className="neu-border neu-press bg-white hover:bg-cream h-9 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
              >
                {copied ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <LinkIcon className="mr-2 h-4 w-4" />
                )}
                {copied ? "Copied! ✓" : "Copy Link"}
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
            className="neu-border bg-white px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <Calendar aria-hidden="true" size={14} strokeWidth={3} />
            Add to Google Calendar
          </a>
        )}
        {hasRsvpd && googleCalendarUrl && (
          <button
            onClick={handleDownloadIcs}
            type="button"
            className="neu-border bg-white px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2 text-black"
          >
            <Calendar aria-hidden="true" size={14} strokeWidth={3} />
            Add to Apple/Outlook
          </button>
        )}
        {hasRsvpd && myRsvp && (
          <Button
            type="button"
            onClick={() => setTicketOpen(true)}
            variant="outline"
            className="neu-border neu-press bg-white hover:bg-cream h-9 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 text-black"
          >
            View Ticket
          </Button>
        )}
      </div>

      <div className="mt-4">
        <ShareMenu
          url={typeof window !== "undefined" ? window.location.href : ""}
          title={event.title}
          text={`Check out this event: ${event.title}`}
        />
      </div>

      <ConfirmModal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        title="Cancel your RSVP?"
        description="Are you sure you want to remove your RSVP for this event?"
        confirmText="Yes, cancel RSVP"
        onConfirm={() => {
          onRsvpToggle?.(event.id, true);
          setConfirmOpen(false);
        }}
      />

      <TicketDialog
        open={ticketOpen}
        onOpenChange={setTicketOpen}
        event={event}
        rsvpId={myRsvp?.id ?? ""}
      />
    </>
  );
}
