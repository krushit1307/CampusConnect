import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SteganographicQRCode } from "@/components/SteganographicQRCode";
import { SteganographicQRScanner } from "@/components/SteganographicQRScanner";
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
  const [activeTab, setActiveTab] = useState<"ticket" | "scanner">("ticket");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md neu-border bg-cream max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-black">Event Ticket</DialogTitle>
            <div className="flex rounded-md border-2 border-black bg-white p-0.5 font-mono text-[10px] font-bold">
              <button
                onClick={() => setActiveTab("ticket")}
                className={`rounded px-2.5 py-1 ${
                  activeTab === "ticket" ? "bg-black text-white" : "text-black hover:bg-muted"
                }`}
              >
                Ticket QR
              </button>
              <button
                onClick={() => setActiveTab("scanner")}
                className={`rounded px-2.5 py-1 ${
                  activeTab === "scanner" ? "bg-black text-white" : "text-black hover:bg-muted"
                }`}
              >
                Verify Ticket
              </button>
            </div>
          </div>

          <DialogDescription>
            {activeTab === "ticket"
              ? "Show this steganographically signed QR code at entrance check-in."
              : "Verify ticket image authenticity via hidden LSB Ed25519 signature."}
          </DialogDescription>
        </DialogHeader>

        {activeTab === "ticket" ? (
          <div className="mt-2 flex flex-col items-center gap-4">
            <SteganographicQRCode rsvpId={rsvpId} size={200} />

            <div className="w-full space-y-2 text-center">
              <h3 className="text-lg font-bold">{event.title}</h3>

              <p className="text-sm text-muted-foreground">{formatEventDateRange(event)}</p>

              <p className="text-sm text-muted-foreground">{event.location ?? "Location TBA"}</p>

              <div className="mt-2 rounded-md border bg-muted p-3">
                <p className="font-mono text-xs uppercase">RSVP ID</p>
                <p className="mt-1 font-bold break-all font-mono text-sm">{ticketId}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <SteganographicQRScanner />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
