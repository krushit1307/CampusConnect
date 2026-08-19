import { useState, useEffect } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Modal } from "@/components/ui/modal";
import { SteganographicQRScanner } from "@/components/SteganographicQRScanner";
import ScratchTicket from "@/components/ScratchTicket/ScratchTicket";
import { formatEventDateRange } from "@/lib/utils";
import { DownloadTicketButton } from "@/lib/ticket/DownloadTicketButton";
import { useQrCodeDataUrl } from "@/lib/ticket/useQrCodeDataUrl";
import type { TicketPdfInput } from "@/lib/ticket/types";
import { signChallenge } from "@/lib/crypto/ticketCrypto";

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
  const { qrCodeDataUrl, qrCanvasRef } = useQrCodeDataUrl(ticketId);

  const ticketPdfInput: TicketPdfInput = {
    event: {
      title: event.title,
      startDate: event.start_date ?? event.event_date,
      endDate: event.end_date,
      location: event.location,
    },
    attendee: {},
    ticketId,
    qrCodeDataUrl,
  };
  const [ticketRevealed, setTicketRevealed] = useState(false);

  // Decentralized Ticketing: Dynamic Time-based Challenge
  const [dynamicPayload, setDynamicPayload] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== "ticket") return;

    const generatePayload = async () => {
      try {
        // Challenge changes every 30 seconds
        const challenge = Math.floor(Date.now() / 30000).toString();
        const signature = await signChallenge(challenge);
        const payload = JSON.stringify({ ticketId: rsvpId, challenge, signature });
        setDynamicPayload(payload);
      } catch (err) {
        console.error("Failed to generate dynamic QR payload:", err);
        setDynamicPayload(rsvpId); // Fallback
      }
    };

    generatePayload();
    const interval = setInterval(generatePayload, 30000);
    return () => clearInterval(interval);
  }, [activeTab, rsvpId]);

  const customHeader = (
    <div className="flex flex-col space-y-1.5 text-center sm:text-left w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">Event Ticket</h2>
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
      <p className="text-sm text-muted-foreground mt-2">
        {activeTab === "ticket"
          ? "Show this steganographically signed QR code at entrance check-in."
          : "Verify ticket image authenticity via hidden LSB Ed25519 signature."}
      </p>
    </div>
  );

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={customHeader}
      className="sm:max-w-md neu-border bg-cream max-sm:pb-8 max-h-[90vh] overflow-y-auto"
    >
      {/* Mobile drag handle indicator */}
      <div className="mx-auto -mt-6 mb-4 h-1.5 w-10 rounded-full bg-muted-foreground/30 sm:hidden" />
      {activeTab === "ticket" ? (
        <ScratchTicket onRevealed={() => setTicketRevealed(true)}>
          <div className="mt-2 flex flex-col items-center gap-4">
            {dynamicPayload ? (
              <div className="relative p-2 bg-white rounded-xl border-4 border-violet-500 animate-pulse-border">
                <QRCodeSVG value={dynamicPayload} size={200} level="H" />
                <div className="absolute inset-0 border-4 border-violet-500 rounded-xl opacity-50 blur-sm pointer-events-none" />
              </div>
            ) : (
              <div className="w-[200px] h-[200px] bg-muted animate-pulse rounded-xl" />
            )}
            <div className="w-full space-y-2 text-center">
              <h3 className="text-lg font-bold">{event.title}</h3>
              <p className="text-sm text-muted-foreground">{formatEventDateRange(event)}</p>
              <p className="text-sm text-muted-foreground">{event.location ?? "Location TBA"}</p>
              <div className="mt-2 rounded-md border bg-muted p-3">
                <p className="font-mono text-xs uppercase">RSVP ID</p>
                <p className="mt-1 font-bold break-all font-mono text-sm">{ticketId}</p>
              </div>
              {ticketRevealed && (
                <p className="text-sm font-bold text-green-600 mt-2">✨ Ready to enter!</p>
              )}
            </div>

            {/* Off-screen QR canvas used to snapshot the PNG data URL for the PDF */}
            <div className="hidden" aria-hidden="true">
              <QRCodeCanvas value={ticketId} size={200} level="H" ref={qrCanvasRef} />
            </div>

            <div className="w-full">
              <DownloadTicketButton ticket={ticketPdfInput} />
            </div>
          </div>
        </ScratchTicket>
      ) : (
        <div className="mt-2">
          <SteganographicQRScanner />
        </div>
      )}
    </Modal>
  );
}
