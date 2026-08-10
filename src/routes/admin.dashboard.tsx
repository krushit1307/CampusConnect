import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { withAuth, WithAuthProps } from "@/hoc/withAuth";
import { SiteShell } from "@/components/site/SiteShell";
import { Shield, Activity, Users, AlertTriangle, CheckCircle, BarChart3 } from "lucide-react";
import { useQuery } from "@/hooks/useReactQueryReplacement";

function AdminDashboardContent({ user }: WithAuthProps) {
  const supabase = createClient();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user has super_admin role in app_metadata
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.app_metadata?.role === "super_admin") {
        setIsSuperAdmin(true);
      } else {
        setIsSuperAdmin(false);
      }
    });
  }, [supabase.auth]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["super-admin-stats"],
    queryFn: async () => {
      // In a real app, these would be RPC calls or materialized views.
      const { count: clubCount } = await supabase.from("clubs").select("*", { count: "exact", head: true });
      const { count: eventCount } = await supabase.from("events").select("*", { count: "exact", head: true });
      const { count: userCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });

      return {
        totalClubs: clubCount || 0,
        activeEvents: eventCount || 0,
        totalUsers: userCount || 0,
      };
    },
    enabled: isSuperAdmin === true,
  });

  if (isSuperAdmin === false) {
    return (
      <SiteShell>
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#fb923c] p-8 text-center text-black">
          <Shield className="mb-4 h-24 w-24" />
          <h1 className="font-display text-5xl font-black">Access Denied</h1>
          <p className="mt-4 font-mono text-xl font-bold">This portal is strictly locked to the student_union role.</p>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#f3f4f6] p-8">
        <header className="mb-8 border-b-4 border-black pb-4">
          <h1 className="font-display text-4xl font-extrabold text-black">Student Union Oversight</h1>
          <p className="font-mono text-sm font-bold text-gray-700">Global Dashboard & Compliance Platform</p>
        </header>

        {isLoading || !stats ? (
          <div className="flex h-64 items-center justify-center">
            <Activity className="h-12 w-12 animate-pulse text-black" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Stat Card 1 */}
            <div className="neu-border bg-[#0bc5ea] p-6 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-sm font-bold uppercase text-black">Total Clubs</h3>
                <Users className="h-6 w-6 text-black" />
              </div>
              <p className="mt-4 font-display text-5xl font-black text-black">{stats.totalClubs}</p>
              <div className="mt-4 flex items-center gap-2 font-mono text-xs font-bold text-black/80">
                <CheckCircle className="h-4 w-4" />
                <span>All compliant this term</span>
              </div>
            </div>

            {/* Stat Card 2 */}
            <div className="neu-border bg-[#a3e635] p-6 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-sm font-bold uppercase text-black">Active Events</h3>
                <Activity className="h-6 w-6 text-black" />
              </div>
              <p className="mt-4 font-display text-5xl font-black text-black">{stats.activeEvents}</p>
              <div className="mt-4 flex items-center gap-2 font-mono text-xs font-bold text-black/80">
                <BarChart3 className="h-4 w-4" />
                <span>+12% vs last week</span>
              </div>
            </div>

            {/* Stat Card 3 */}
            <div className="neu-border bg-[#fb923c] p-6 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-sm font-bold uppercase text-black">Total Students</h3>
                <Shield className="h-6 w-6 text-black" />
              </div>
              <p className="mt-4 font-display text-5xl font-black text-black">{stats.totalUsers}</p>
              <div className="mt-4 flex items-center gap-2 font-mono text-xs font-bold text-black/80">
                <AlertTriangle className="h-4 w-4" />
                <span>4 reports pending review</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12">
          <h2 className="mb-4 font-display text-2xl font-bold text-black">Recent Platform Activity</h2>
          <div className="neu-border bg-white p-8 text-center font-mono text-sm shadow-[6px_6px_0px_rgba(0,0,0,1)]">
            Detailed compliance tables and funding allocation workflows will be rendered here.
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

export default withAuth(AdminDashboardContent);
