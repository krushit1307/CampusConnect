import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import EventSeriesAnalyticsDashboard from "@/components/Clubs/EventSeriesAnalyticsDashboard";
import { createClient } from "@/lib/supabase/client";
import { useAuthHydration } from "@/hooks/useAuthHydration";

export default function ClubSeriesAnalyticsRoute() {
  const { slug } = useParams();
  const supabase = createClient();
  const { user, isInitializing } = useAuthHydration();

  const [clubId, setClubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug || !user) return;

    const loadClub = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("clubs")
        .select("id")
        .eq("slug", slug)
        .single();

      if (!error && data) {
        setClubId(data.id);
      }

      setLoading(false);
    };

    loadClub();
  }, [slug, user]);

  if (isInitializing || loading) {
    return (
      <SiteShell>
        <div className="flex min-h-screen items-center justify-center">
          <p className="font-mono text-sm">
            Loading...
          </p>
        </div>
      </SiteShell>
    );
  }

  if (!clubId) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-3xl p-8 text-center">
          <h1 className="font-display text-3xl font-black uppercase">
            Club not found
          </h1>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <main className="min-h-screen bg-cream px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <EventSeriesAnalyticsDashboard clubId={clubId} />
        </div>
      </main>
    </SiteShell>
  );
}