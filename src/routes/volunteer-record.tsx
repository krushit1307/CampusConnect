import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { useAuthHydration } from "@/hooks/useAuthHydration";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VolunteerLedgerTable } from "@/components/volunteer/VolunteerLedgerTable";
import { VolunteerApprovalPanel } from "@/components/volunteer/VolunteerApprovalPanel";
import { VolunteerTranscriptButton } from "@/components/volunteer/VolunteerTranscriptButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Clock, CheckCircle, Activity, Award } from "lucide-react";

export default function VolunteerRecordPage() {
  const [session] = useAuthHydration();
  const supabase = createClient();
  const [stats, setStats] = useState({ totalApproved: 0, totalPending: 0 });
  const [isPresident, setIsPresident] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      loadStats();
      checkPresidentStatus();
    }
  }, [session]);

  const loadStats = async () => {
    if (!session?.user?.id) return;
    const { data, error } = await supabase
      .from("volunteer_ledger")
      .select("hours_credited, status")
      .eq("user_id", session.user.id);

    if (error) {
      toast.error("Failed to load volunteer stats");
      return;
    }

    let approved = 0;
    let pending = 0;
    data?.forEach((entry) => {
      if (entry.status === "approved") approved += Number(entry.hours_credited);
      if (entry.status === "pending") pending += Number(entry.hours_credited);
    });
    setStats({ totalApproved: approved, totalPending: pending });
  };

  const checkPresidentStatus = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .limit(1);

    if (data && data.length > 0) {
      setIsPresident(true);
    } else {
      // Also check if they created any clubs
      const { data: clubData } = await supabase
        .from("clubs")
        .select("id")
        .eq("created_by", session.user.id)
        .limit(1);
      if (clubData && clubData.length > 0) {
        setIsPresident(true);
      }
    }
  };

  if (!session) {
    return (
      <SiteShell>
        <div className="flex h-[50vh] items-center justify-center">
          <p className="text-muted-foreground">Please log in to view your volunteer record.</p>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="container mx-auto py-8 space-y-8 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Volunteer Record</h1>
            <p className="text-muted-foreground mt-2">
              Track your community service hours and generate official transcripts.
            </p>
          </div>
          <VolunteerTranscriptButton userId={session.user.id} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Award className="w-4 h-4 mr-2" /> Total Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.totalApproved.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Hours credited this semester</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Clock className="w-4 h-4 mr-2" /> Pending Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-amber-500">
                {stats.totalPending.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting club admin approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Activity className="w-4 h-4 mr-2" /> Milestones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">
                {stats.totalApproved >= 20
                  ? "Completed"
                  : `${(20 - stats.totalApproved).toFixed(1)} to go`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">20-hour scholarship requirement</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold tracking-tight">Recent Activity</h2>
            <VolunteerLedgerTable userId={session.user.id} onRecordUpdated={loadStats} />
          </div>

          <div className="space-y-6">
            {isPresident && (
              <>
                <h2 className="text-xl font-semibold tracking-tight">Admin Approvals</h2>
                <VolunteerApprovalPanel onApproved={loadStats} />
              </>
            )}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
