import { QRCodeSVG } from "qrcode.react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { formatEventDateRange } from "@/lib/utils";

interface Event {
  id: string;
  title: string;
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location: string | null;
}

interface TicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
  rsvpId: string;
}

export function TicketDialog({ open, onOpenChange, event, rsvpId }: TicketDialogProps) {
  const ticketId = rsvpId.slice(-6).toUpperCase();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md neu-border bg-cream">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Event Ticket</DialogTitle>

          <DialogDescription>
            Show this QR code at the event entrance for quick check-in.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col items-center gap-4">
          <div className="rounded-lg border bg-white p-5">
            <QRCodeSVG value={rsvpId} size={220} />
          </div>

          <div className="w-full space-y-2 text-center">
            <h3 className="text-lg font-bold">{event.title}</h3>

            <p className="text-sm text-muted-foreground">{formatEventDateRange(event)}</p>

            <p className="text-sm text-muted-foreground">{event.location ?? "Location TBA"}</p>

            <div className="mt-4 rounded-md border bg-muted p-3">
              <p className="font-mono text-xs uppercase">RSVP ID</p>

              <p className="mt-1 font-bold break-all font-mono text-sm">{ticketId}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
