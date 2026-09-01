import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HeartHandshake, Sparkles } from "lucide-react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import {
  fetchActiveCampaign,
  fetchCampaignMatchActivity,
  fetchCampaignMatchInvitation,
  fetchTopDonors,
  formatCents,
  isCampaignEnded,
} from "@/lib/crowdfunding";
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
  const [searchParams] = useSearchParams();
  const [isDonateOpen, setIsDonateOpen] = useState(false);
  const matchId = searchParams.get("match_id");

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

  const { data: matchActivity = [] } = useQuery({
    queryKey: ["campaign-match-activity", campaign?.id],
    queryFn: () => fetchCampaignMatchActivity(supabase, campaign!.id),
    enabled: Boolean(campaign?.id),
  });

  const { data: matchInvitation, isLoading: isMatchLoading } = useQuery({
    queryKey: ["campaign-match-invitation", matchId],
    queryFn: () => fetchCampaignMatchInvitation(supabase, matchId!),
    enabled: Boolean(matchId),
  });

  if (isCampaignLoading) return null;
  if (!campaign) return null;

  const ended = isCampaignEnded(campaign);
  const activeMatchInvitation =
    matchId && matchInvitation?.campaign_id === campaign.id ? matchInvitation : null;

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

        {!ended && !matchId && (
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

      {matchId && (
        <div className="neu-border mt-5 bg-yellow-50 p-4 text-black">
          {isMatchLoading ? (
            <p className="font-mono text-xs">Loading your alumni match invitation...</p>
          ) : activeMatchInvitation ? (
            <>
              <p className="font-mono text-xs font-bold uppercase">Alumni matching invitation</p>
              <p className="mt-1 font-mono text-xs text-gray-700">
                {activeMatchInvitation.source_display_name} donated{" "}
                <strong>{formatCents(activeMatchInvitation.requested_amount_cents)}</strong>. Match
                the same amount to double the campaign&apos;s impact.
              </p>
              <button
                type="button"
                onClick={() => setIsDonateOpen(true)}
                className="neu-border neu-press mt-3 inline-flex items-center gap-2 bg-lime px-4 py-2 font-mono text-xs font-bold uppercase text-black"
              >
                <HeartHandshake className="h-3.5 w-3.5" />
                Match this donation
              </button>
            </>
          ) : (
            <p className="font-mono text-xs text-red-700">
              This alumni match invitation is no longer available.
            </p>
          )}
        </div>
      )}

      <TopDonorsLeaderboard donors={topDonors} isLoading={isDonorsLoading} />

      {matchActivity.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-black dark:text-white">
            <Sparkles className="h-3.5 w-3.5" />
            Alumni Matches
          </h4>
          <ul className="space-y-1.5">
            {matchActivity.map((match) => (
              <li
                key={match.match_id}
                className="neu-border flex flex-wrap items-center justify-between gap-2 bg-lime/20 px-3 py-2 font-mono text-xs text-black"
              >
                <span>
                  {match.source_display_name}&apos;s {formatCents(match.requested_amount_cents)} was
                  matched by {match.alumni_display_name}
                </span>
                <span className="font-bold">+{formatCents(match.requested_amount_cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DonateDialog
        campaign={campaign}
        matchId={activeMatchInvitation ? (matchId ?? undefined) : undefined}
        matchInvitation={activeMatchInvitation}
        open={isDonateOpen}
        onOpenChange={setIsDonateOpen}
      />
    </div>
  );
}
