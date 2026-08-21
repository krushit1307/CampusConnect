import { useState } from "react";
import { HeartHandshake } from "lucide-react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { fetchActiveCampaign, fetchTopDonors, isCampaignEnded } from "@/lib/crowdfunding";
import { CampaignProgressBar } from "./CampaignProgressBar";
import { TopDonorsLeaderboard } from "./TopDonorsLeaderboard";
import { DonateDialog } from "./DonateDialog";

interface CrowdfundingCampaignSectionProps {
  clubId: string;
}

/**
 * Renders the club's active crowdfunding campaign (goal progress bar + top
 * donors leaderboard + Donate button) on the club's public profile. Renders
 * nothing if the club has no active campaign, so it's safe to always mount.
 */
export function CrowdfundingCampaignSection({ clubId }: CrowdfundingCampaignSectionProps) {
  const supabase = createClient();
  const [isDonateOpen, setIsDonateOpen] = useState(false);

  const { data: campaign, isLoading: isCampaignLoading } = useQuery({
    queryKey: ["crowdfunding-campaign", clubId],
    queryFn: () => fetchActiveCampaign(supabase, clubId),
    enabled: Boolean(clubId),
  });

  const { data: topDonors = [], isLoading: isDonorsLoading } = useQuery({
    queryKey: ["campaign-top-donors", campaign?.id],
    queryFn: () => fetchTopDonors(supabase, campaign!.id),
    enabled: Boolean(campaign?.id),
  });

  if (isCampaignLoading) return null;
  if (!campaign) return null;

  const ended = isCampaignEnded(campaign);

  return (
    <div className="neu-border mt-8 border-2 border-black bg-white p-6 dark:border-cream dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow neu-border inline-block bg-lime px-2 py-0.5 text-xs font-bold uppercase text-black">
            Crowdfunding Campaign
          </span>
          <h3 className="font-display mt-2 text-xl font-bold uppercase tracking-tight text-black dark:text-white">
            {campaign.title}
          </h3>
          {campaign.description && (
            <p className="mt-1 max-w-2xl font-mono text-xs text-gray-600 dark:text-gray-400">
              {campaign.description}
            </p>
          )}
          {campaign.end_date && (
            <p className="mt-1 font-mono text-[10px] uppercase text-gray-500">
              {ended ? "Campaign ended" : "Ends"} {new Date(campaign.end_date).toLocaleDateString()}
            </p>
          )}
        </div>

        {!ended && (
          <button
            onClick={() => setIsDonateOpen(true)}
            className="neu-border neu-press flex shrink-0 items-center gap-2 bg-lime px-5 py-2.5 font-mono text-xs font-bold uppercase text-black transition-transform hover:-translate-y-1"
          >
            <HeartHandshake className="h-3.5 w-3.5" />
            Donate
          </button>
        )}
      </div>

      <div className="mt-5">
        <CampaignProgressBar campaign={campaign} />
      </div>

      <TopDonorsLeaderboard donors={topDonors} isLoading={isDonorsLoading} />

      <DonateDialog campaign={campaign} open={isDonateOpen} onOpenChange={setIsDonateOpen} />
    </div>
  );
}
