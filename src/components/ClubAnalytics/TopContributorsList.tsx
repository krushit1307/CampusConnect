import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { Crown, MessageSquare, FileText } from "lucide-react";
import type { TopContributor } from "@/hooks/useClubAnalytics";

interface TopContributorsListProps {
  contributors: TopContributor[];
}

const RANK_COLORS = ["bg-yellow-400", "bg-gray-300", "bg-amber-600", "bg-white", "bg-white"];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TopContributorsList({ contributors }: TopContributorsListProps) {
  if (contributors.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 font-mono text-sm text-gray-400">
        No contributors data yet.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {contributors.map((c, i) => (
        <li
          key={c.user_id}
          className="neu-border flex items-center gap-4 bg-white p-3 shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5 transition-transform"
        >
          <div
            className={`flex items-center justify-center w-8 h-8 neu-border font-mono text-xs font-black ${RANK_COLORS[i] || "bg-white"}`}
          >
            {i === 0 ? <Crown size={16} className="text-black" /> : i + 1}
          </div>
          <Avatar className="h-10 w-10 neu-border shrink-0">
            <AvatarImage src={c.avatar_url} alt={c.full_name} className="object-cover" />
            <AvatarFallback className="bg-sky font-mono text-xs font-bold">
              {getInitials(c.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-sm truncate">{c.full_name}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-gray-500">
                <FileText size={10} />
                {c.post_count} posts
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-gray-500">
                <MessageSquare size={10} />
                {c.comment_count} comments
              </span>
            </div>
          </div>
          <div className="shrink-0">
            <span className="neu-border bg-lime px-2 py-1 font-mono text-[10px] font-bold">
              {c.post_count + c.comment_count} pts
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
