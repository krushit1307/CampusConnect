import { motion, useReducedMotion } from "framer-motion";
import {
  formatCents,
  getCampaignProgressPercent,
  type CrowdfundingCampaign,
} from "@/lib/crowdfunding";

interface CampaignProgressBarProps {
  campaign: CrowdfundingCampaign;
}

/**
 * Goal-progress bar for a club crowdfunding campaign.
 *
 * The *fill* width is always `min(100%, current/target)` — even when a
 * campaign is overfunded the bar stops at the edge of its neu-border
 * container instead of overflowing. The raised/actual percentage (which can
 * exceed 100%) is still shown in the label so donors can see a campaign was
 * exceeded.
 */
export function CampaignProgressBar({ campaign }: CampaignProgressBarProps) {
  const prefersReducedMotion = useReducedMotion();
  const cappedPercent = getCampaignProgressPercent(campaign);
  const rawPercent =
    campaign.target_amount_cents > 0
      ? (campaign.current_amount_cents / campaign.target_amount_cents) * 100
      : 0;
  const isOverfunded = rawPercent > 100;

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 font-mono">
        <span className="text-lg font-bold text-black dark:text-white">
          {formatCents(campaign.current_amount_cents)}
          <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">
            raised of {formatCents(campaign.target_amount_cents)} goal
          </span>
        </span>
        <span
          className={`text-xs font-bold uppercase ${isOverfunded ? "text-lime" : "text-black dark:text-white"}`}
        >
          {Math.round(rawPercent)}% funded
        </span>
      </div>

      <div
        className="neu-border h-6 w-full overflow-hidden bg-white p-0.5 dark:bg-zinc-900"
        role="progressbar"
        aria-valuenow={Math.round(cappedPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Campaign funding progress: ${Math.round(rawPercent)}% of goal`}
      >
        <motion.div
          className={`h-full ${isOverfunded ? "bg-lime" : "bg-primary"}`}
          initial={{ width: 0 }}
          animate={{ width: `${cappedPercent}%` }}
          transition={
            prefersReducedMotion ? { duration: 0 } : { duration: 0.8, ease: "easeOut" }
          }
        />
      </div>

      {isOverfunded && (
        <p className="mt-1 font-mono text-[10px] font-bold uppercase text-lime">
          🎉 Goal exceeded — thank you!
        </p>
      )}
    </div>
  );
}
