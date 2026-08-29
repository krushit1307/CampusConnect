import React, { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ShieldAlert,
  Settings,
  DollarSign,
  Power,
  Activity,
  RefreshCcw,
  AlertTriangle,
  Server,
  CloudLightning,
  Clock,
  History,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// -----------------------------------------------------------------------------
// Interfaces & Types
// -----------------------------------------------------------------------------
interface BillingLog {
  id: string;
  recorded_at: string;
  current_cost: number;
  max_budget: number;
}

interface CircuitBreakerAudit {
  id: string;
  triggered_at: string;
  cost_at_termination: number;
  max_budget: number;
  terminated_instance_count: number;
  instance_ids: string[];
  sms_sent_to: string;
}

interface EventData {
  id: string;
  title: string;
  max_aws_budget: number | null;
}

interface HardwareBillingCapManagerProps {
  eventId: string;
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------
export const HardwareBillingCapManager: React.FC<HardwareBillingCapManagerProps> = ({
  eventId,
}) => {
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [billingLogs, setBillingLogs] = useState<BillingLog[]>([]);
  const [audits, setAudits] = useState<CircuitBreakerAudit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [budgetInput, setBudgetInput] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const supabase = createClient();

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch Event Budget
      const { data: event, error: eventErr } = await supabase
        .from("events")
        .select("id, title, max_aws_budget")
        .eq("id", eventId)
        .single();

      if (eventErr) throw eventErr;
      setEventData(event);
      if (event?.max_aws_budget !== null) {
        setBudgetInput(event.max_aws_budget.toString());
      }

      // Fetch Billing Logs (Last 24 items = 6 hours at 15m intervals)
      const { data: logs, error: logsErr } = await supabase
        .from("event_aws_billing_logs")
        .select("*")
        .eq("event_id", eventId)
        .order("recorded_at", { ascending: false })
        .limit(24);

      if (!logsErr && logs) setBillingLogs(logs);

      // Fetch Audits
      const { data: auditData, error: auditErr } = await supabase
        .from("aws_circuit_breaker_audits")
        .select("*")
        .eq("event_id", eventId)
        .order("triggered_at", { ascending: false });

      if (!auditErr && auditData) setAudits(auditData);
    } catch (err) {
      console.error("Failed to fetch billing data", err);
    } finally {
      setLoading(false);
    }
  }, [eventId, supabase]);

  useEffect(() => {
    fetchData();

    // Setup realtime subscription for logs and audits
    const logSub = supabase
      .channel("billing_logs_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_aws_billing_logs",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => setBillingLogs((prev) => [payload.new as BillingLog, ...prev].slice(0, 24)),
      )
      .subscribe();

    const auditSub = supabase
      .channel("audit_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "aws_circuit_breaker_audits",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => setAudits((prev) => [payload.new as CircuitBreakerAudit, ...prev]),
      )
      .subscribe();

    return () => {
      logSub.unsubscribe();
      auditSub.unsubscribe();
    };
  }, [fetchData, eventId, supabase]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleSaveBudget = async () => {
    const parsed = parseFloat(budgetInput);
    if (isNaN(parsed) || parsed < 0) {
      alert("Invalid budget amount.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({ max_aws_budget: parsed })
        .eq("id", eventId);

      if (error) throw error;
      setEventData((prev) => (prev ? { ...prev, max_aws_budget: parsed } : null));
    } catch (err) {
      console.error(err);
      alert("Failed to update budget.");
    } finally {
      setSaving(false);
    }
  };

  const handleSimulateCircuitBreaker = async () => {
    setIsSimulating(true);
    try {
      // We manually invoke the edge function via RPC or http for testing
      const { data, error } = await supabase.functions.invoke("aws-billing-circuit-breaker", {
        body: { simulate_event_id: eventId },
      });
      if (error) throw error;
      alert("Circuit Breaker simulation completed. Check logs.");
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to trigger circuit breaker.");
    } finally {
      setIsSimulating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Chart Rendering (SVG based for raw control, ~150 lines)
  // ---------------------------------------------------------------------------
  const renderChart = () => {
    if (billingLogs.length === 0) {
      return (
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-slate-700 bg-slate-900">
          <p className="text-sm font-mono text-slate-500">No telemetry data available.</p>
        </div>
      );
    }

    const maxCostInLogs = Math.max(...billingLogs.map((l) => l.current_cost));
    const budget = eventData?.max_aws_budget || 100;
    const yMax = Math.max(maxCostInLogs * 1.2, budget * 1.2);

    // Sort chronological
    const sorted = [...billingLogs].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );

    const chartWidth = 800;
    const chartHeight = 250;
    const padding = 40;
    const innerWidth = chartWidth - padding * 2;
    const innerHeight = chartHeight - padding * 2;

    const points = sorted
      .map((log, index) => {
        const x = padding + (index / Math.max(sorted.length - 1, 1)) * innerWidth;
        const y = padding + innerHeight - (log.current_cost / yMax) * innerHeight;
        return `${x},${y}`;
      })
      .join(" ");

    const budgetY = padding + innerHeight - (budget / yMax) * innerHeight;

    return (
      <div className="relative w-full overflow-hidden rounded-lg bg-slate-950 p-4 border border-slate-800 shadow-inner">
        <h4 className="absolute left-6 top-4 font-mono text-xs uppercase tracking-wider text-slate-400">
          AWS Cost Trajectory (Last 6 Hours)
        </h4>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto drop-shadow-md">
          {/* Grid lines */}
          <line
            x1={padding}
            y1={padding}
            x2={chartWidth - padding}
            y2={padding}
            stroke="#334155"
            strokeDasharray="4"
          />
          <line
            x1={padding}
            y1={padding + innerHeight / 2}
            x2={chartWidth - padding}
            y2={padding + innerHeight / 2}
            stroke="#334155"
            strokeDasharray="4"
          />
          <line
            x1={padding}
            y1={padding + innerHeight}
            x2={chartWidth - padding}
            y2={padding + innerHeight}
            stroke="#334155"
          />

          {/* Budget Line */}
          {budget > 0 && (
            <g>
              <line
                x1={padding}
                y1={budgetY}
                x2={chartWidth - padding}
                y2={budgetY}
                stroke="#ef4444"
                strokeWidth="2"
                strokeDasharray="8"
              />
              <text
                x={chartWidth - padding + 10}
                y={budgetY + 4}
                fill="#ef4444"
                fontSize="12"
                fontFamily="monospace"
                fontWeight="bold"
              >
                CAP: ${budget.toFixed(2)}
              </text>
            </g>
          )}

          {/* Area Fill */}
          <polygon
            points={`${padding},${padding + innerHeight} ${points} ${padding + innerWidth},${padding + innerHeight}`}
            fill="url(#gradient)"
            opacity="0.2"
          />
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke="#6366f1"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {sorted.map((log, index) => {
            const x = padding + (index / Math.max(sorted.length - 1, 1)) * innerWidth;
            const y = padding + innerHeight - (log.current_cost / yMax) * innerHeight;
            const isDanger = log.current_cost >= budget;
            return (
              <circle
                key={log.id}
                cx={x}
                cy={y}
                r="4"
                fill={isDanger ? "#ef4444" : "#818cf8"}
                stroke="#0f172a"
                strokeWidth="2"
              />
            );
          })}
        </svg>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // UI Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <RefreshCcw className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  const currentCost = billingLogs[0]?.current_cost || 0;
  const isExceeded =
    eventData?.max_aws_budget !== null && currentCost >= (eventData?.max_aws_budget || 0);

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto font-sans">
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-indigo-500/10 p-3">
            <Server className="h-8 w-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Hardware Resource Billing Cap
            </h1>
            <p className="text-slate-400 font-mono text-sm mt-1">
              Automated Financial Circuit Breaker for{" "}
              <strong className="text-indigo-300">{eventData?.title}</strong>
            </p>
          </div>
        </div>

        {isExceeded && (
          <div className="flex items-center gap-2 rounded-full bg-red-500/20 px-4 py-2 border border-red-500/50">
            <ShieldAlert className="h-5 w-5 text-red-400 animate-pulse" />
            <span className="font-bold text-red-400 tracking-wide uppercase text-sm">
              Breaker Tripped
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Config */}
        <div className="space-y-8 lg:col-span-1">
          <Card className="border-slate-800 bg-slate-900 shadow-2xl">
            <CardHeader className="border-b border-slate-800 bg-slate-950/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Settings className="h-5 w-5 text-indigo-400" />
                Budget Configuration
              </CardTitle>
              <CardDescription className="text-slate-400">
                Define the absolute maximum AWS spend for this event.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Maximum Allowable Budget (USD)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="number"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    placeholder="e.g. 150.00"
                    className="h-14 pl-12 bg-slate-950 border-slate-800 text-lg font-mono text-white focus:border-indigo-500 focus:ring-indigo-500/20"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  If telemetry detects costs exceeding this limit, all associated EC2 instances will
                  be immediately and permanently terminated.
                </p>
              </div>

              <Button
                onClick={handleSaveBudget}
                disabled={saving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-white font-bold tracking-wide shadow-lg shadow-indigo-900/20"
              >
                {saving ? (
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  "Enforce Budget Cap"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-900/50 bg-red-950/10 shadow-2xl">
            <CardHeader className="border-b border-red-900/50 bg-red-950/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-red-400">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-sm text-red-300/80 mb-6 leading-relaxed">
                Manually trigger the circuit breaker. This mimics the automated cron job and will
                execute AWS EC2 Terminate APIs for this event's infrastructure.
              </p>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full h-12 font-bold uppercase tracking-wider border-2 border-red-600/50 hover:bg-red-900/50"
                  >
                    <Power className="mr-2 h-4 w-4" /> Terminate Infra Now
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-950 border-red-900">
                  <DialogHeader>
                    <DialogTitle className="text-red-500 text-2xl flex items-center gap-2">
                      <ShieldAlert className="h-6 w-6" /> Destructive Action
                    </DialogTitle>
                    <DialogDescription className="text-slate-300 text-base pt-4">
                      Are you absolutely sure? This will permanently destroy all servers tagged with
                      this event. Data on ephemeral storage will be lost forever.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-6">
                    <Button variant="outline" className="border-slate-700 text-slate-300">
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleSimulateCircuitBreaker}
                      disabled={isSimulating}
                    >
                      {isSimulating ? (
                        <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        "Yes, Terminate Everything"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Analytics & Audits */}
        <div className="space-y-8 lg:col-span-2">
          {/* Current Status Banner */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Activity className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Current Trailing Cost
                </span>
              </div>
              <div
                className={`text-4xl font-black font-mono ${isExceeded ? "text-red-500" : "text-emerald-400"}`}
              >
                ${currentCost.toFixed(2)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <History className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Last Telemetry Sync
                </span>
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {billingLogs.length > 0
                  ? new Date(billingLogs[0].recorded_at).toLocaleTimeString()
                  : "N/A"}
              </div>
            </div>
          </div>

          {/* Chart */}
          <Card className="border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
            <CardHeader className="bg-slate-950/50 pb-4 border-b border-slate-800">
              <CardTitle className="flex items-center gap-2 text-white">
                <CloudLightning className="h-5 w-5 text-indigo-400" />
                Real-Time Cloud Telemetry
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">{renderChart()}</CardContent>
          </Card>

          {/* Audits Table */}
          <Card className="border-slate-800 bg-slate-900 shadow-2xl">
            <CardHeader className="bg-slate-950/50 pb-4 border-b border-slate-800">
              <CardTitle className="flex items-center gap-2 text-white">
                <ShieldAlert className="h-5 w-5 text-indigo-400" />
                Circuit Breaker Audit Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {audits.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center">
                  <div className="bg-slate-800/50 p-4 rounded-full mb-4">
                    <Info className="h-8 w-8 text-slate-500" />
                  </div>
                  <p className="text-slate-400 font-medium">No circuit breakers tripped yet.</p>
                  <p className="text-slate-500 text-sm mt-1">
                    If the budget is exceeded, the termination log will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950/80 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-6 py-4 font-bold tracking-wider">Timestamp</th>
                        <th className="px-6 py-4 font-bold tracking-wider">Cost at Trip</th>
                        <th className="px-6 py-4 font-bold tracking-wider">Instances Terminated</th>
                        <th className="px-6 py-4 font-bold tracking-wider">Notification SMS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {audits.map((audit) => (
                        <tr key={audit.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-slate-500" />
                              {new Date(audit.triggered_at).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-red-400 font-bold whitespace-nowrap">
                            ${audit.cost_at_termination.toFixed(2)}
                            <span className="text-slate-600 text-xs ml-2 font-normal">
                              (Limit: ${audit.max_budget})
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center justify-center bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-md px-2.5 py-0.5 font-bold">
                              {audit.terminated_instance_count}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-xs truncate max-w-[200px]">
                            {audit.sms_sent_to}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HardwareBillingCapManager;
