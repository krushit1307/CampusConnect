import { useEffect, useState } from "react";
import { Loader2, HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import {
  createCampaignDonationCheckout,
  formatCents,
  type CampaignMatchInvitation,
  type CrowdfundingCampaign,
} from "@/lib/crowdfunding";

interface DonateDialogProps {
  campaign: CrowdfundingCampaign;
  matchId?: string;
  matchInvitation?: CampaignMatchInvitation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_AMOUNTS_USD = [10, 25, 50, 100];

export function DonateDialog({
  campaign,
  matchId,
  matchInvitation,
  open,
  onOpenChange,
}: DonateDialogProps) {
  const supabase = createClient();
  const [selectedAmount, setSelectedAmount] = useState<number>(
    matchInvitation ? matchInvitation.requested_amount_cents / 100 : 25,
  );
  const [customAmount, setCustomAmount] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (matchInvitation) {
      setSelectedAmount(matchInvitation.requested_amount_cents / 100);
      setCustomAmount("");
      return;
    }
    setSelectedAmount(25);
    setCustomAmount("");
  }, [matchInvitation?.requested_amount_cents]);

  const effectiveAmountUsd = customAmount ? Number(customAmount) : selectedAmount;
  const amountOptions = matchInvitation
    ? [matchInvitation.requested_amount_cents / 100]
    : PRESET_AMOUNTS_USD;
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

    const amountCents = Math.round(effectiveAmountUsd * 100);
    if (matchInvitation && amountCents !== matchInvitation.requested_amount_cents) {
      toast.error(
        `This invitation requires an exact gift of ${formatCents(matchInvitation.requested_amount_cents)}.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const { url } = await createCampaignDonationCheckout(supabase, {
        campaignId: campaign.id,
        amountCents,
        isAnonymous,
        matchId,
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
              {matchInvitation ? "Match this donation" : "Donate to"} &ldquo;{campaign.title}&rdquo;
            </DialogTitle>
            <p className="mt-1 font-mono text-xs text-gray-600 dark:text-gray-400">
              Your donation goes straight toward this campaign&apos;s goal.
            </p>
          </div>
        </div>

        {matchInvitation && (
          <div className="neu-border mt-4 bg-yellow-50 p-3 font-mono text-xs text-black">
            Match the exact amount of{" "}
            <strong>{formatCents(matchInvitation.requested_amount_cents)}</strong>
            to double this student donation&apos;s impact.
          </div>
        )}

        <div className="mt-5 grid grid-cols-4 gap-2">
          {amountOptions.map((amount) => (
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
              {matchInvitation ? formatCents(matchInvitation.requested_amount_cents) : `$${amount}`}
            </button>
          ))}
        </div>

        {!matchInvitation && (
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
        )}

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
            `${matchInvitation ? "Match" : "Donate"} $${isValidAmount ? effectiveAmountUsd : "0"}`
          )}
        </button>
      </DialogContent>
    </Dialog>
  );
}
