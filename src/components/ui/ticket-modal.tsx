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
  const handleDownload = () => {
    const svg = document.getElementById(`ticket-qr-${ticketId}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `Ticket-${ticketId}.png`;
        downloadLink.href = `${pngFile}`;
        downloadLink.click();
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

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
            <QRCodeSVG id={`ticket-qr-${ticketId}`} value={rsvpId} size={220} />
          </div>

          <div className="w-full space-y-2 text-center">
            <h3 className="text-lg font-bold">{event.title}</h3>

            <p className="text-sm text-muted-foreground">{formatEventDateRange(event)}</p>

            <p className="text-sm text-muted-foreground">{event.location ?? "Location TBA"}</p>

            <div className="mt-4 rounded-md border bg-muted p-3">
              <p className="font-mono text-xs uppercase">RSVP ID</p>

              <p className="mt-1 font-bold break-all font-mono text-sm">{ticketId}</p>
            </div>

            <button
              onClick={handleDownload}
              className="neu-border neu-press mt-4 w-full bg-black px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-cream"
            >
              Download Ticket
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
