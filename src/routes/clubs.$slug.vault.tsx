import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";
import { VaultDashboard } from "@/components/vault/VaultDashboard";
import { Button } from "@/components/ui/button";

export default function ClubVaultRoute() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);

  useEffect(() => {
    async function loadVaultContext() {
      setLoading(true);
      try {
        const { data: clubData, error: clubError } = await supabase
          .from("clubs")
          .select("id, name, slug")
          .eq("slug", slug)
          .single();

        if (clubError || !clubData) {
          navigate("/clubs");
          return;
        }

        setClub(clubData);

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          navigate("/auth");
          return;
        }

        const { data: memberData } = await supabase
          .from("club_members")
          .select("role")
          .eq("club_id", clubData.id)
          .eq("user_id", session.user.id)
          .single();

        setMembership(memberData);

        const execRoles = ["president", "vice_president", "treasurer", "secretary", "admin"];
        if (!memberData || !execRoles.includes(memberData.role)) {
          // not authorized, redirect to club page
          navigate(`/clubs/${clubData.slug}`);
          return;
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadVaultContext();
  }, [slug, navigate]);

  if (loading) {
    return (
      <SiteShell>
        <div className="flex justify-center items-center h-96">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </SiteShell>
    );
  }

  if (!club || !membership) {
    return null; // redirecting
  }

  return (
    <SiteShell>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate(`/clubs/${club.slug}`)}
              className="mb-2 -ml-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to {club.name}
            </Button>
            <h1 className="text-3xl font-bold">Club Vault</h1>
            <p className="text-muted-foreground">
              Secure document repository for {club.name} executives
            </p>
          </div>
        </div>

        <VaultDashboard clubId={club.id} />
      </div>
    </SiteShell>
  );
}
