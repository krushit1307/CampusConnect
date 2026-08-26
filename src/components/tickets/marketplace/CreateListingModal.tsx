import React, { useState } from "react";
import {
  ListingType,
  TicketTierName,
} from "@/types/ticketTransferMarketplace";
import { ticketTransferMarketplaceService } from "@/services/ticketTransferMarketplaceService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Ticket, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onListingCreated: () => void;
}

export const CreateListingModal: React.FC<CreateListingModalProps> = ({
  isOpen,
  onClose,
  onListingCreated,
}) => {
  const [eventTitle, setEventTitle] = useState("Spring Campus Music Fest 2026");
  const [venueName, setVenueName] = useState("Main Campus Amphitheater");
  const [ticketTier, setTicketTier] = useState<TicketTierName>("General Admission");
  const [listingType, setListingType] = useState<ListingType>("sell");
  const [faceValueUSD, setFaceValueUSD] = useState<number>(35);
  const [askingPriceUSD, setAskingPriceUSD] = useState<number>(35);
  const [tradePreferences, setTradePreferences] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const faceValueCents = Math.round(faceValueUSD * 100);
    const askingPriceCents = Math.round(askingPriceUSD * 100);

    try {
      ticketTransferMarketplaceService.createListing({
        eventId: `evt-${Date.now()}`,
        eventTitle,
        eventDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        venueName,
        ticketId: `tkt-${Math.floor(1000 + Math.random() * 9000)}`,
        ticketTier,
        faceValueCents,
        askingPriceCents,
        listingType,
        tradePreferences,
        sellerId: "user-rushabh",
        sellerName: "Rushabh Mahajan",
        notes,
      });

      onListingCreated();
      onClose();

      // Reset form
      setAskingPriceUSD(35);
      setTradePreferences("");
      setNotes("");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create ticket listing.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-slate-800 bg-slate-950 text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
            <Ticket className="h-5 w-5 text-blue-400" />
            List Ticket on Campus Marketplace
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Safe peer-to-peer student ticket transfer with anti-scalping price caps & instant QR re-generation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 my-2">
          {/* Step 1: Listing Type Tabs */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
              1. Listing Type
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {(["sell", "trade", "buy_request"] as ListingType[]).map((type) => {
                const isSelected = listingType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setListingType(type)}
                    className={`py-2 rounded-xl border text-xs font-bold capitalize transition-all ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-500 shadow-md"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {type.replace("_", " ")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Event & Venue */}
          <div>
            <Label htmlFor="eventTitle" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Event Title
            </Label>
            <Input
              id="eventTitle"
              required
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="mt-1 border-slate-800 bg-slate-900 text-white text-xs"
            />
          </div>

          {/* Ticket Tier & Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Ticket Tier
              </Label>
              <select
                value={ticketTier}
                onChange={(e) => setTicketTier(e.target.value as TicketTierName)}
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white"
              >
                <option value="General Admission">General Admission</option>
                <option value="VIP Access">VIP Access</option>
                <option value="Early Bird">Early Bird</option>
                <option value="Student Floor">Student Floor</option>
              </select>
            </div>

            <div>
              <Label htmlFor="faceValueUSD" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Face Value ($)
              </Label>
              <Input
                id="faceValueUSD"
                type="number"
                min={0}
                required
                value={faceValueUSD}
                onChange={(e) => setFaceValueUSD(Number(e.target.value))}
                className="mt-1 border-slate-800 bg-slate-900 text-white text-xs"
              />
            </div>
          </div>

          {/* Asking Price & Anti Scalping Cap Indicator */}
          <div>
            <div className="flex justify-between items-center">
              <Label htmlFor="askingPriceUSD" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Asking Price ($)
              </Label>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Max Cap: ${faceValueUSD}
              </span>
            </div>
            <Input
              id="askingPriceUSD"
              type="number"
              min={0}
              max={faceValueUSD}
              required
              value={askingPriceUSD}
              onChange={(e) => setAskingPriceUSD(Number(e.target.value))}
              className="mt-1 border-slate-800 bg-slate-900 text-white text-xs font-bold"
            />
          </div>

          {/* Trade Preferences if trade */}
          {listingType === "trade" && (
            <div>
              <Label htmlFor="tradePreferences" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Trade Preferences
              </Label>
              <Input
                id="tradePreferences"
                placeholder="e.g. Will trade for VIP pass or Basketball game ticket"
                value={tradePreferences}
                onChange={(e) => setTradePreferences(e.target.value)}
                className="mt-1 border-slate-800 bg-slate-900 text-white text-xs"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Additional Listing Notes
            </Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="e.g. Instant transfer upon Venmo/Campus Pay..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 border-slate-800 bg-slate-900 text-white text-xs"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-red-500/20 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-center gap-1.5 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-800 text-slate-400 hover:text-white text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Post Listing
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
