import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { ClubAnalyticsPage } from "@/components/ClubAnalytics/ClubAnalyticsPage";
import { createClient } from "@/lib/supabase/client";
import { useAuthHydration } from "@/hooks/useAuthHydration";

export default function ClubAnalyticsRoute() {
  const { slug } = useParams();
  const supabase = createClient();
  const { user, isInitializing } = useAuthHydration();
  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState("");
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!slug || !user) return;
    (async () => {
      setLoading(true);
      const { data: club } = await supabase
        .from("clubs")
        .select("id,name")
        .eq("slug", slug)
        .single();
      if (!club) {
        setLoading(false);
        return;
      }
      const { data: m } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", club.id)
        .eq("user_id", user.id)
        .eq("status", "approved")
        .single();
      if (!m || (m.role !== "admin" && m.role !== "owner")) {
        setDenied(true);
        setLoading(false);
        return;
      }
      setClubId(club.id);
      setClubName(club.name);
      setLoading(false);
    })();
  }, [slug, user, supabase]);

  if (isInitializing || loading)
    return (
      <SiteShell>
        <div className="flex min-h-screen items-center justify-center bg-cream">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
            <p className="font-mono text-sm mt-4">Loading analytics...</p>
          </div>
        </div>
      </SiteShell>
    );

  if (denied)
    return (
      <SiteShell>
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <div className="neu-border bg-white p-8 text-center shadow-[4px_4px_0_0_#000] max-w-md">
            <h1 className="font-display text-2xl font-black uppercase mb-2">Access Denied</h1>
            <p className="font-mono text-sm text-gray-600">Only club admins can view analytics.</p>
          </div>
        </div>
      </SiteShell>
    );

  if (!clubId)
    return (
      <SiteShell>
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <h1 className="font-display text-3xl font-black uppercase">Club Not Found</h1>
        </div>
      </SiteShell>
    );

  return (
    <SiteShell>
      <main className="min-h-screen bg-cream px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <ClubAnalyticsPage clubId={clubId} clubName={clubName} />
        </div>
      </main>
    </SiteShell>
  );
}
