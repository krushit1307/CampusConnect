import { Users, Building2, CalendarCheck } from "lucide-react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { getSystemCounts, type SystemCount } from "@/services/systemCounters";
import AnimatedCounter from "@/components/ui/AnimatedCounter";

interface StatCardConfig {
  tableName: SystemCount["table_name"];
  label: string;
  icon: typeof Users;
  bg: string;
}

const STAT_CARDS: StatCardConfig[] = [
  { tableName: "profiles", label: "Active members", icon: Users, bg: "bg-lime" },
  { tableName: "clubs", label: "Clubs", icon: Building2, bg: "bg-sky" },
  { tableName: "events", label: "Events hosted", icon: CalendarCheck, bg: "bg-lavender" },
];

export function GlobalFeedStats() {
  const { data: counts, isLoading } = useQuery({
    queryKey: ["system-counts"],
    queryFn: getSystemCounts,
    staleTime: 1000 * 60 * 5,
  });

  const countFor = (tableName: SystemCount["table_name"]) =>
    counts?.find((c) => c.table_name === tableName)?.row_count ?? 0;

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
      {STAT_CARDS.map(({ tableName, label, icon: Icon, bg }) => (
        <div key={tableName} className={`neu-border neu-shadow-sm ${bg} p-4`}>
          <Icon size={20} strokeWidth={2.5} />
          <div className="mt-3 font-display text-3xl font-bold leading-none sm:text-4xl">
            {isLoading ? (
              <span className="inline-block h-8 w-20 animate-pulse bg-black/10" />
            ) : (
              <AnimatedCounter value={countFor(tableName)} />
            )}
          </div>
          <p className="eyebrow mt-2 font-bold">{label}</p>
        </div>
      ))}
    </div>
  );
}

export default GlobalFeedStats;
