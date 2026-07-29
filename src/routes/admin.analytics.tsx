import { useCallback, useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { ShieldAlert, BarChart3, Users, Calendar, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@/hooks/useReactQueryReplacement";

interface ProfileRole {
  role: string | null;
}

interface DauRecord {
  activity_date: string;
  daily_active_users: number;
}

export default function AnalyticsAdmin() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [dauData, setDauData] = useState<DauRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const loadDauData = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_dau_analytics");

    if (error) {
      throw new Error(error.message);
    }

    // Parse and reverse to chronological order for the chart (oldest first)
    const formatted: DauRecord[] = (
      (data || []) as {
        activity_date: string;
        daily_active_users: string | number;
      }[]
    )
      .map((item) => ({
        activity_date: item.activity_date,
        daily_active_users: Number(item.daily_active_users),
      }))
      .reverse();

    setDauData(formatted);
  }, [supabase]);

  useEffect(() => {
    let active = true;

    const initialise = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!active) return;
        setUser(currentUser);

        if (!currentUser) return;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", currentUser.id)
          .single<ProfileRole>();

        if (profileError) throw new Error(profileError.message);
        if (!active) return;

        setRole(profile.role);
        if (profile.role === "system_admin") {
          await loadDauData();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load analytics data.");
      } finally {
        if (active) {
          setLoading(false);
          setAuthChecked(true);
        }
      }
    };

    void initialise();
    return () => {
      active = false;
    };
  }, [loadDauData, supabase]);

  if (loading) {
    return (
      <SiteShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
        </div>
      </SiteShell>
    );
  }

  if (authChecked && (!user || role !== "system_admin")) {
    return <Navigate to="/" replace />;
  }

  // Calculate some analytics summaries
  const totalDays = dauData.length;
  const maxDau = totalDays > 0 ? Math.max(...dauData.map((d) => d.daily_active_users)) : 0;
  const avgDau =
    totalDays > 0
      ? Math.round(dauData.reduce((acc, d) => acc + d.daily_active_users, 0) / totalDays)
      : 0;
  const currentDau = totalDays > 0 ? dauData[totalDays - 1].daily_active_users : 0;

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-[#E9D5FF] px-4 py-14 md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow font-bold text-black flex items-center gap-1.5 uppercase font-mono text-xs">
                <BarChart3 className="h-4 w-4" /> System Analytics
              </p>
              <h1 className="mt-2 text-4xl font-bold text-black md:text-6xl font-display">
                Daily Active Users.
              </h1>
            </div>
            <Link
              to="/admin/clubs/pending"
              className="neu-border text-center bg-white px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-cream"
            >
              Moderation Panel
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="neu-border bg-lime p-6">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs font-bold uppercase text-black/60">Current DAU</p>
                <Users className="h-5 w-5 text-black/80" />
              </div>
              <p className="mt-2 font-display text-3xl font-black">{currentDau}</p>
              <p className="mt-1 font-mono text-[10px] text-black/50">Active users today</p>
            </div>

            <div className="neu-border bg-sky p-6">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs font-bold uppercase text-black/60">Average DAU</p>
                <TrendingUp className="h-5 w-5 text-black/80" />
              </div>
              <p className="mt-2 font-display text-3xl font-black">{avgDau}</p>
              <p className="mt-1 font-mono text-[10px] text-black/50">90-day daily average</p>
            </div>

            <div className="neu-border bg-peach p-6">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs font-bold uppercase text-black/60">Peak DAU</p>
                <ShieldAlert className="h-5 w-5 text-black/80" />
              </div>
              <p className="mt-2 font-display text-3xl font-black">{maxDau}</p>
              <p className="mt-1 font-mono text-[10px] text-black/50">Maximum daily active users</p>
            </div>

            <div className="neu-border bg-lavender p-6">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs font-bold uppercase text-black/60">Time Horizon</p>
                <Calendar className="h-5 w-5 text-black/80" />
              </div>
              <p className="mt-2 font-display text-3xl font-black">{totalDays} Days</p>
              <p className="mt-1 font-mono text-[10px] text-black/50">Historical tracking window</p>
            </div>
          </div>

          {/* Chart Container */}
          <div className="neu-border bg-white p-6">
            <h2 className="font-display text-xl font-bold uppercase text-black">
              Active User Trend
            </h2>
            <p className="font-mono text-xs text-gray-500 mb-6">
              Daily active users mapped across the last 90 days
            </p>

            <div className="h-96 w-full">
              {dauData.length === 0 ? (
                <div className="flex h-full items-center justify-center font-mono text-sm text-gray-400">
                  No active session data recorded yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dauData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dauGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A3E635" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#A3E635" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="activity_date"
                      stroke="#000000"
                      fontSize={10}
                      fontFamily="monospace"
                      tickFormatter={(date) => {
                        try {
                          const parts = date.split("-");
                          return `${parts[1]}/${parts[2]}`;
                        } catch {
                          return date;
                        }
                      }}
                    />
                    <YAxis stroke="#000000" fontSize={10} fontFamily="monospace" />
                    <Tooltip
                      contentStyle={{
                        border: "2px solid #000000",
                        boxShadow: "4px 4px 0px 0px #000000",
                        fontFamily: "monospace",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="daily_active_users"
                      name="Active Users"
                      stroke="#000000"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#dauGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
