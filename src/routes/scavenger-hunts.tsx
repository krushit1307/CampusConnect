import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import Trophy from "lucide-react/dist/esm/icons/trophy";
import Compass from "lucide-react/dist/esm/icons/compass";

export default function ScavengerHuntsList() {
  const supabase = createClient();

  const { data: hunts = [], isLoading } = useQuery({
    queryKey: ["scavenger_hunts_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scavenger_hunts")
        .select(`
          id,
          title,
          description,
          hunt_waypoints (id)
        `);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <SiteShell>
      <div className="min-h-screen bg-cream px-4 py-12 md:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Header Card */}
          <div className="neu-border bg-[#FEE2E2] p-8 shadow-[4px_4px_0_0_#000]">
            <p className="eyebrow flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-black">
              <Compass className="h-4 w-4 animate-spin-slow" /> University Gamification
            </p>
            <h1 className="mt-2 font-display text-4xl font-black text-black md:text-5xl uppercase">
              Campus Scavenger Hunts
            </h1>
            <p className="mt-4 max-w-xl font-mono text-sm text-black/75">
              Explore your campus by finding hidden physical locations, scanning waypoints, unlocking clues, and winning huge rewards!
            </p>
          </div>

          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
            </div>
          ) : hunts.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {hunts.map((hunt: any) => (
                <div
                  key={hunt.id}
                  className="neu-border bg-white p-6 shadow-[4px_4px_0_0_#000] hover:-translate-y-1 transition-transform flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="neu-border bg-[#a3e635] px-2.5 py-1 font-mono text-[10px] font-bold uppercase">
                        {hunt.hunt_waypoints?.length || 0} Waypoints
                      </span>
                      <span className="flex items-center gap-1 font-mono text-xs font-bold text-yellow-600">
                        <Trophy size={14} /> 1000 Pts
                      </span>
                    </div>
                    <h2 className="font-display text-xl font-black uppercase tracking-tight">
                      {hunt.title}
                    </h2>
                    <p className="font-mono text-xs text-black/60 line-clamp-3">
                      {hunt.description || "No description provided."}
                    </p>
                  </div>
                  <Link
                    to={`/scavenger-hunts/${hunt.id}`}
                    className="neu-border neu-press mt-6 block w-full bg-black text-white p-2.5 text-center font-mono text-xs font-bold uppercase"
                  >
                    Start Hunt
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="neu-border bg-white p-12 text-center shadow-[4px_4px_0_0_#000]">
              <p className="font-mono text-sm text-black/55 italic">
                No active scavenger hunts found. Check back later!
              </p>
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
