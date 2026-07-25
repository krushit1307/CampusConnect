import { Calendar, Link as LinkIcon } from "lucide-react";
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
    confirmOpen,
    setConfirmOpen,
    ticketOpen,
    setTicketOpen,
    onRsvpToggle,
  } = useEventCardContext();

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
                <LinkIcon className="h-4 w-4 mr-2" />
                Copy Link
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
