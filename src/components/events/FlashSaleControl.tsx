import { useState } from "react";
import { Flame, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FlashSaleControl({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("50");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [isStarting, setIsStarting] = useState(false);

  const startFlashSale = async () => {
    const discount = Number(discountPercent);
    const duration = Number(durationMinutes);
    if (!Number.isInteger(discount) || discount < 1 || discount > 90) {
      toast.error("Choose a whole-number discount from 1% to 90%.");
      return;
    }
    if (!Number.isInteger(duration) || duration < 5 || duration > 1440) {
      toast.error("Choose a duration from 5 minutes to 24 hours.");
      return;
    }

    setIsStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke("start-flash-sale", {
        body: { eventId, discountPercent: discount, durationMinutes: duration },
      });
      if (error) throw error;
      const count = Number(data?.notificationCount ?? 0);
      toast.success(`Flash sale is live. ${count} opted-in students notified.`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the flash sale.");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="neu-border neu-press h-12 bg-red-500 px-5 font-mono text-sm font-black uppercase tracking-wider text-black hover:bg-red-400"
        >
          <Flame className="mr-2 h-4 w-4" aria-hidden="true" /> Trigger Flash Sale
        </Button>
      </DialogTrigger>
      <DialogContent className="neu-border bg-cream text-black sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-black uppercase">
            Trigger flash sale
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-black/70">
            The discounted Stripe Price will be activated server-side. Waitlisted students and
            opted-in club followers receive an urgent push notification.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-4">
          <div className="grid gap-2">
            <Label htmlFor="flash-sale-discount" className="font-mono text-xs font-black uppercase">
              Discount percentage
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="flash-sale-discount"
                type="number"
                min={1}
                max={90}
                step={1}
                value={discountPercent}
                onChange={(event) => setDiscountPercent(event.target.value)}
                className="neu-border bg-white font-mono"
              />
              <span className="font-display text-2xl font-black">%</span>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="flash-sale-duration" className="font-mono text-xs font-black uppercase">
              Duration in minutes
            </Label>
            <Input
              id="flash-sale-duration"
              type="number"
              min={5}
              max={1440}
              step={5}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              className="neu-border bg-white font-mono"
            />
            <p className="font-mono text-[11px] text-black/60">
              Allowed window: 5 minutes to 24 hours.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isStarting}
            className="neu-border font-mono font-bold uppercase"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void startFlashSale()}
            disabled={isStarting}
            className="neu-border neu-press bg-red-500 font-mono font-black uppercase text-black hover:bg-red-400"
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…
              </>
            ) : (
              "Start sale"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
