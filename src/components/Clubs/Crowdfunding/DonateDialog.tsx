import { useState } from "react";
import { Loader2, HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { createCampaignDonationCheckout, type CrowdfundingCampaign } from "@/lib/crowdfunding";

interface DonateDialogProps {
  campaign: CrowdfundingCampaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_AMOUNTS_USD = [10, 25, 50, 100];

export function DonateDialog({ campaign, open, onOpenChange }: DonateDialogProps) {
  const supabase = createClient();
  const [selectedAmount, setSelectedAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveAmountUsd = customAmount ? Number(customAmount) : selectedAmount;
  const isValidAmount = Number.isFinite(effectiveAmountUsd) && effectiveAmountUsd >= 1;

  const handleDonate = async () => {
    if (!isValidAmount) {
      toast.error("Enter a donation amount of at least $1.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to donate.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { url } = await createCampaignDonationCheckout(supabase, {
        campaignId: campaign.id,
        amountCents: Math.round(effectiveAmountUsd * 100),
        isAnonymous,
      });
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start checkout.";
      toast.error(message);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="neu-border max-w-md bg-white p-6 dark:bg-zinc-900">
        <div className="flex items-start gap-3">
          <div className="neu-border shrink-0 bg-lime p-2 text-black">
            <HeartHandshake className="h-6 w-6" />
          </div>
          <div>
            <DialogTitle className="font-display text-xl font-bold text-black dark:text-white">
              Donate to &ldquo;{campaign.title}&rdquo;
            </DialogTitle>
            <p className="mt-1 font-mono text-xs text-gray-600 dark:text-gray-400">
              Your donation goes straight toward this campaign&apos;s goal.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2">
          {PRESET_AMOUNTS_USD.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => {
                setSelectedAmount(amount);
                setCustomAmount("");
              }}
              className={`neu-border neu-press py-2 font-mono text-sm font-bold ${
                !customAmount && selectedAmount === amount
                  ? "bg-lime text-black"
                  : "bg-white text-black dark:bg-zinc-800 dark:text-white"
              }`}
            >
              ${amount}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <label className="mb-1 block font-mono text-[10px] font-bold uppercase text-gray-500">
            Or enter a custom amount
          </label>
          <div className="neu-border flex items-center bg-white px-3 dark:bg-zinc-800">
            <span className="font-mono text-sm font-bold text-gray-500">$</span>
            <input
              type="number"
              min={1}
              step="1"
              inputMode="decimal"
              placeholder="0.00"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full bg-transparent px-2 py-2 font-mono text-sm font-bold text-black outline-none dark:text-white"
            />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 font-mono text-xs text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="h-4 w-4 accent-black"
          />
          Donate anonymously (hides your name from the Top Donors leaderboard)
        </label>

        <button
          onClick={handleDonate}
          disabled={isSubmitting || !isValidAmount}
          className="neu-border neu-press mt-6 flex w-full items-center justify-center gap-2 bg-lime px-4 py-3 font-mono text-sm font-bold uppercase text-black disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Redirecting to checkout...
            </>
          ) : (
            `Donate $${isValidAmount ? effectiveAmountUsd : "0"}`
          )}
        </button>
      </DialogContent>
    </Dialog>
  );
}
