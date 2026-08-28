import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRightLeft,
  Coins,
  DollarSign,
  Check,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@/hooks/useReactQueryReplacement";

interface ProfileRole {
  role: string | null;
}

interface TrendDashboardRecord {
  tag: string;
  current_count: number;
  velocity: string;
  alert_triggered: boolean;
  underfunded_club_id: string;
  underfunded_club_name: string;
  underfunded_club_balance: number;
  reallocation_source_club_id: string;
  reallocation_source_club_name: string;
  reallocation_source_club_balance: number;
  recommendation: string;
}

interface TagHistoryRecord {
  week_start: string;
  count: number;
}

export default function TrendsForecastingAdmin() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [selectedTag, setSelectedTag] = useState<string>("#QuantumComputing");
  const [reallocateAmount, setReallocateAmount] = useState<number>(1500);

  // Auth validation
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
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not verify credentials.");
      } finally {
        if (active) setAuthChecked(true);
      }
    };

    void initialise();
    return () => {
      active = false;
    };
  }, [supabase]);

  // Load forecasting dashboard metrics
  const { data: trends = [], isLoading: isLoadingTrends } = useQuery<TrendDashboardRecord[]>({
    queryKey: ["trend-forecasting-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_trend_forecasting_dashboard");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: role === "system_admin",
  });

  // Load 5-week history of the selected tag
  const { data: tagHistory = [], isLoading: isLoadingHistory } = useQuery<TagHistoryRecord[]>({
    queryKey: ["tag-weekly-history", selectedTag],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tag_weekly_stats")
        .select("week_start, count")
        .eq("tag", selectedTag)
        .order("week_start", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: role === "system_admin" && !!selectedTag,
  });

  // Automatically update reallocation amount defaults when trend selection changes
  const selectedTrend = trends.find((t) => t.tag === selectedTag) || trends[0];

  useEffect(() => {
    if (selectedTrend) {
      const maxTransfer = Math.floor(selectedTrend.reallocation_source_club_balance);
      setReallocateAmount(Math.min(1500, maxTransfer));
    }
  }, [selectedTag, selectedTrend]);

  const handleExecuteReallocation = () => {
    if (!selectedTrend) return;
    toast.success(
      `Budget proposal submitted! Reallocated $${reallocateAmount.toLocaleString()} from ${selectedTrend.reallocation_source_club_name} to ${selectedTrend.underfunded_club_name}.`,
    );
  };

  // Redirect unauthorized
  if (authChecked && (!user || role !== "system_admin")) return <Navigate to="/" replace />;

  const chartData = tagHistory.map((item) => ({
    week: new Date(item.week_start).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    count: item.count,
  }));

  return (
    <SiteShell>
      {/* Header */}
      <section className="border-b-2 border-black bg-[#FAE8FF] px-4 py-14 md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-black">
                <Activity className="h-4.5 w-4.5" /> Trend Forecasting
              </p>
              <h1 className="mt-2 font-display text-4xl font-bold text-black md:text-6xl">
                Tag Velocity & Budgets.
              </h1>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/admin/analytics"
                className="neu-border text-center bg-white px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-cream"
              >
                Back to Analytics
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="bg-cream px-4 py-12 md:px-6 min-h-screen">
        <div className="mx-auto max-w-7xl space-y-8">
          {isLoadingTrends ? (
            <div className="py-20 text-center font-mono font-bold text-lg animate-pulse">
              Loading tag analytics and predictive models...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Left Column: Active Alerts & Tag Table */}
              <div className="space-y-8 lg:col-span-2">
                {/* Active Alerts */}
                <div className="neu-border bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <h2 className="font-display text-2xl font-bold uppercase mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-amber-500 animate-bounce" /> Active Trend
                    Alerts
                  </h2>
                  <div className="space-y-4">
                    {trends.filter((t) => t.alert_triggered).length === 0 ? (
                      <p className="font-mono text-sm text-black/60">
                        No active high-velocity trends detected this week.
                      </p>
                    ) : (
                      trends
                        .filter((t) => t.alert_triggered)
                        .map((trend) => (
                          <div
                            key={trend.tag}
                            className="neu-border bg-[#FEF3C7] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div>
                              <span className="font-mono text-xs font-bold uppercase bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                                Rising Trend ({trend.velocity} WoW)
                              </span>
                              <h3 className="font-display text-xl font-bold mt-1 text-black">
                                {trend.tag}
                              </h3>
                              <p className="font-mono text-xs text-black/70 mt-1">
                                {trend.recommendation}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedTag(trend.tag)}
                              className="neu-border bg-black text-white px-3 py-1.5 font-mono text-xs font-bold uppercase hover:bg-black/80 whitespace-nowrap self-start md:self-center"
                            >
                              Analyze Velocity
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* All Tag Velocities Table */}
                <div className="neu-border bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <h2 className="font-display text-2xl font-bold uppercase mb-4 flex items-center gap-2">
                    <TrendingUp className="h-6 w-6" /> Tag Velocity & Frequency
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-sm">
                      <thead>
                        <tr className="border-b-2 border-black">
                          <th className="py-3 font-bold uppercase">Tag Name</th>
                          <th className="py-3 font-bold uppercase text-center">Weekly Count</th>
                          <th className="py-3 font-bold uppercase text-center">WoW Velocity</th>
                          <th className="py-3 font-bold uppercase text-center">Alert Status</th>
                          <th className="py-3 font-bold uppercase text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trends.map((trend) => {
                          const isDeclining = trend.velocity.startsWith("-");
                          return (
                            <tr
                              key={trend.tag}
                              onClick={() => setSelectedTag(trend.tag)}
                              className={`border-b border-black/10 hover:bg-cream/40 cursor-pointer transition-colors ${
                                selectedTag === trend.tag ? "bg-[#FAF5FF]" : ""
                              }`}
                            >
                              <td className="py-4 font-bold text-black flex items-center gap-1.5">
                                {trend.tag}
                                {trend.tag === selectedTag && (
                                  <span className="h-2 w-2 rounded-full bg-purple-600 animate-ping" />
                                )}
                              </td>
                              <td className="py-4 text-center font-bold">{trend.current_count}</td>
                              <td className="py-4 text-center">
                                <span
                                  className={`inline-flex items-center gap-0.5 font-bold px-2 py-0.5 rounded-full ${
                                    isDeclining
                                      ? "bg-red-100 text-red-700"
                                      : "bg-green-100 text-green-700"
                                  }`}
                                >
                                  {isDeclining ? (
                                    <TrendingDown className="h-3 w-3" />
                                  ) : (
                                    <TrendingUp className="h-3 w-3" />
                                  )}
                                  {trend.velocity}
                                </span>
                              </td>
                              <td className="py-4 text-center">
                                {trend.alert_triggered ? (
                                  <span className="font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-300 text-xs">
                                    TRIGGERED
                                  </span>
                                ) : (
                                  <span className="text-black/40 text-xs">Stable</span>
                                )}
                              </td>
                              <td className="py-4 text-right">
                                <button
                                  type="button"
                                  className="font-bold text-xs uppercase underline hover:text-purple-700"
                                >
                                  Select
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column: Weekly History & Budget Reallocation */}
              <div className="space-y-8">
                {/* 5-Week Trend History Chart */}
                <div className="neu-border bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-2xl font-bold uppercase">5-Week Forecast</h2>
                    <span className="font-mono text-xs bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                      {selectedTag}
                    </span>
                  </div>
                  {isLoadingHistory ? (
                    <div className="h-64 flex items-center justify-center font-mono animate-pulse">
                      Loading velocity timeline...
                    </div>
                  ) : chartData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center font-mono text-black/60">
                      No historical timeline data found.
                    </div>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#C084FC" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#C084FC" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                          <XAxis
                            dataKey="week"
                            stroke="#000000"
                            fontSize={11}
                            fontClass="font-mono"
                          />
                          <YAxis stroke="#000000" fontSize={11} fontClass="font-mono" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#FFF",
                              border: "2px solid #000",
                              borderRadius: "0px",
                              fontFamily: "monospace",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#8B5CF6"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorCount)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Actionable Budget Reallocation proposals */}
                {selectedTrend && (
                  <div className="neu-border bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-6">
                    <h2 className="font-display text-2xl font-bold uppercase flex items-center gap-2">
                      <Coins className="h-6 w-6 text-purple-600" /> Reallocation Tool
                    </h2>

                    {/* Proposal description */}
                    <div className="p-3 bg-purple-50 border border-purple-200 text-xs font-mono text-purple-950">
                      <span className="font-bold">PROPOSAL:</span> Move funding from the declining
                      trend (e.g. Blockchain) to the rising trend (e.g. Quantum Computing).
                    </div>

                    {/* Interactive diagram card */}
                    <div className="space-y-4 font-mono text-sm">
                      <div className="flex items-center justify-between border-b border-black/10 pb-2">
                        <div>
                          <p className="text-xs text-black/50">SOURCE (Declining)</p>
                          <p className="font-bold">{selectedTrend.reallocation_source_club_name}</p>
                          <p className="text-xs font-bold text-red-600">
                            Orig Balance: $
                            {selectedTrend.reallocation_source_club_balance.toLocaleString()}
                          </p>
                          <p className="text-xs font-bold text-gray-700">
                            Post Balance: $
                            {(
                              selectedTrend.reallocation_source_club_balance - reallocateAmount
                            ).toLocaleString()}
                          </p>
                        </div>
                        <TrendingDown className="h-8 w-8 text-red-500 bg-red-50 p-1.5 rounded-full border border-red-200" />
                      </div>

                      {/* Slider & Input */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span>Transfer Amount:</span>
                          <span className="font-bold text-purple-600">
                            ${reallocateAmount.toLocaleString()}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={Math.floor(selectedTrend.reallocation_source_club_balance)}
                          value={reallocateAmount}
                          onChange={(e) => setReallocateAmount(Number(e.target.value))}
                          className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-black/50" />
                          <input
                            type="number"
                            min="0"
                            max={Math.floor(selectedTrend.reallocation_source_club_balance)}
                            value={reallocateAmount}
                            onChange={(e) =>
                              setReallocateAmount(
                                Math.min(
                                  Math.floor(selectedTrend.reallocation_source_club_balance),
                                  Math.max(0, Number(e.target.value)),
                                ),
                              )
                            }
                            className="neu-border w-full px-2 py-1 text-sm font-bold bg-cream"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-black/10">
                        <TrendingUp className="h-8 w-8 text-green-500 bg-green-50 p-1.5 rounded-full border border-green-200" />
                        <div className="text-right">
                          <p className="text-xs text-black/50">TARGET (Rising)</p>
                          <p className="font-bold">{selectedTrend.underfunded_club_name}</p>
                          <p className="text-xs font-bold text-green-600">
                            Orig Balance: ${selectedTrend.underfunded_club_balance.toLocaleString()}
                          </p>
                          <p className="text-xs font-bold text-purple-700">
                            Post Balance: $
                            {(
                              Number(selectedTrend.underfunded_club_balance) +
                              Number(reallocateAmount)
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleExecuteReallocation}
                      className="w-full neu-border bg-purple-600 text-white py-3 font-mono text-sm font-bold uppercase hover:bg-purple-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                      <ArrowRightLeft className="h-4 w-4" /> Approve Reallocation
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
