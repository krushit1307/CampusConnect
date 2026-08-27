import { Trophy, VenetianMask } from "lucide-react";
import { formatCents, type TopDonor } from "@/lib/crowdfunding";

interface TopDonorsLeaderboardProps {
  donors: TopDonor[];
  isLoading?: boolean;
}

const MEDAL_BG = ["bg-lime", "bg-sky", "bg-peach"];

export function TopDonorsLeaderboard({ donors, isLoading }: TopDonorsLeaderboardProps) {
  if (isLoading) {
    return (
      <div className="mt-5 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 w-full animate-pulse bg-gray-200 dark:bg-zinc-800" />
        ))}
      </div>
    );
  }

  if (donors.length === 0) {
    return (
      <p className="mt-5 font-mono text-xs text-gray-500 dark:text-gray-400">
        Be the first to donate to this campaign.
      </p>
    );
  }

  return (
    <div className="mt-5">
      <h4 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-black dark:text-white">
        <Trophy className="h-3.5 w-3.5" />
        Top Donors
      </h4>
      <ul className="space-y-1.5">
        {donors.map((donor, index) => (
          <li
            key={`${donor.donor_id ?? "anon"}-${index}`}
            className="neu-border flex items-center justify-between gap-3 bg-white px-3 py-2 dark:bg-zinc-900"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center font-mono text-[10px] font-bold ${
                  MEDAL_BG[index] ?? "bg-cream"
                } neu-border`}
              >
                {index + 1}
              </span>
              <span className="truncate font-mono text-xs font-bold text-black dark:text-white">
                {donor.is_anonymous && <VenetianMask className="mr-1 inline h-3 w-3 align-text-top" />}
                {donor.display_name}
              </span>
            </div>
            <span className="shrink-0 font-mono text-xs font-bold text-black dark:text-white">
              {formatCents(donor.total_donated_cents)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
