// =============================================================================
// File: src/components/hardware/HardwareResourceDashboard.tsx
// Issue: #4304 - Build a 'Real-Time "Hardware Resource" Status Dashboard'
// Description: Real-time Cloud Infrastructure & Hardware Resource telemetry dashboard,
//              crypto-mining anomaly detector, node grid, Spot forecaster, and AWS EC2 kill switch.
// =============================================================================

import React, { useState, useMemo, useEffect } from "react";
import {
  Server,
  Cpu,
  Zap,
  Activity,
  AlertTriangle,
  Flame,
  ShieldAlert,
  ShieldCheck,
  Download,
  Power,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Layers,
  Thermometer,
  HardDrive,
  Network,
  Users,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Lock,
  Leaf,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  CloudInstanceNode,
  InstanceNodeType,
  InstanceHealthStatus,
  ClusterSummaryMetrics,
} from "@/types/hardwareTelemetry";
import {
  NODE_TYPE_SPECS,
  getMockCloudInstances,
  calculateClusterMetrics,
  terminateComputeInstance,
  exportHardwareAuditCSV,
} from "@/services/hardwareTelemetryService";
import {
  calculateSpotSavings,
  calculateComputeCarbonFootprint,
  forecastBudgetDepletion,
} from "@/services/hardwareCostForecaster";
import { InstanceProcessManagerModal } from "@/components/hardware/InstanceProcessManagerModal";

interface HardwareResourceDashboardProps {
  initialInstances?: CloudInstanceNode[];
  eventTitle?: string;
  totalCloudBudgetUsd?: number;
}

export const HardwareResourceDashboard: React.FC<HardwareResourceDashboardProps> = ({
  initialInstances,
  eventTitle = "Annual Spring Hackathon 2026",
  totalCloudBudgetUsd = 800.0,
}) => {
  const [instances, setInstances] = useState<CloudInstanceNode[]>(
    initialInstances || getMockCloudInstances()
  );

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("nodes");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>("all");
  const [showOnlyMiners, setShowOnlyMiners] = useState<boolean>(false);
  const [isTerminateModalOpen, setIsTerminateModalOpen] = useState<boolean>(false);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState<boolean>(false);
  const [isTerminating, setIsTerminating] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [isLiveSimulating, setIsLiveSimulating] = useState<boolean>(true);

  // Selected instance for inspector drawer
  const selectedInstance = useMemo(() => {
    return instances.find((i) => i.id === selectedInstanceId) || null;
  }, [instances, selectedInstanceId]);

  // Derived cluster overview metrics
  const clusterMetrics: ClusterSummaryMetrics = useMemo(() => {
    return calculateClusterMetrics(instances, totalCloudBudgetUsd);
  }, [instances, totalCloudBudgetUsd]);

  // Spot & Carbon analytics
  const spotSavings = useMemo(() => calculateSpotSavings(instances), [instances]);
  const carbonMetrics = useMemo(() => calculateComputeCarbonFootprint(instances, 14.0), [instances]);
  const budgetForecast = useMemo(() => forecastBudgetDepletion(clusterMetrics, 36.0), [clusterMetrics]);

  // Filtered instances
  const filteredInstances = useMemo(() => {
    return instances.filter((inst) => {
      if (showOnlyMiners && !inst.isRogueMinerFlagged) return false;
      if (statusFilter !== "all" && inst.status !== statusFilter) return false;
      if (nodeTypeFilter !== "all" && inst.nodeType !== nodeTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = inst.id.toLowerCase().includes(q);
        const matchesName = inst.instanceName.toLowerCase().includes(q);
        const matchesTeam = inst.assignedTeamName.toLowerCase().includes(q);
        const matchesLead = inst.assignedStudentLead.toLowerCase().includes(q);
        const matchesIp = inst.publicIp.toLowerCase().includes(q);
        if (!matchesId && !matchesName && !matchesTeam && !matchesLead && !matchesIp) {
          return false;
        }
      }
      return true;
    });
  }, [instances, showOnlyMiners, statusFilter, nodeTypeFilter, searchQuery]);

  // Real-time telemetry tick simulation (slight variance every 4 seconds)
  useEffect(() => {
    if (!isLiveSimulating) return;

    const interval = setInterval(() => {
      setInstances((prev) =>
        prev.map((inst) => {
          if (inst.status === "terminated") return inst;

          // If rogue miner, keep CPU pinned high
          if (inst.isRogueMinerFlagged) {
            const jitter = (Math.random() - 0.5) * 1.5;
            const cpu = Math.min(100, Math.max(96, inst.currentTelemetry.cpuUtilizationPercent + jitter));
            return {
              ...inst,
              currentTelemetry: {
                ...inst.currentTelemetry,
                cpuUtilizationPercent: Number(cpu.toFixed(1)),
                networkOutKbps: Math.round(15 + Math.random() * 20),
              },
            };
          }

          // Normal instance fluctuation
          const jitter = (Math.random() - 0.5) * 4;
          const cpu = Math.min(92, Math.max(4, inst.currentTelemetry.cpuUtilizationPercent + jitter));
          const temp = Math.round(40 + (cpu / 100) * 36);

          return {
            ...inst,
            currentTelemetry: {
              ...inst.currentTelemetry,
              cpuUtilizationPercent: Number(cpu.toFixed(1)),
              temperatureCelsius: temp,
            },
          };
        })
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [isLiveSimulating]);

  // Terminate instance handler
  const handleConfirmTerminate = async () => {
    if (!selectedInstance) return;

    setIsTerminating(true);
    const res = await terminateComputeInstance(
      selectedInstance.id,
      selectedInstance.isRogueMinerFlagged
        ? "Unauthorized Monero/Crypto Mining Process Detected (XMRig)"
        : "Organizer Manual Decommission",
      "Hackathon Lead Organizer"
    );

    if (res.success) {
      setInstances((prev) =>
        prev.map((i) =>
          i.id === selectedInstance.id
            ? {
                ...i,
                status: "terminated",
                isRogueMinerFlagged: false,
                currentTelemetry: {
                  ...i.currentTelemetry,
                  cpuUtilizationPercent: 0,
                  gpuUtilizationPercent: i.currentTelemetry.gpuUtilizationPercent !== undefined ? 0 : undefined,
                  temperatureCelsius: 22,
                },
              }
            : i
        )
      );

      setActionSuccessMessage(
        `Instance ${selectedInstance.id} (${selectedInstance.assignedTeamName}) was successfully terminated via AWS EC2 API.`
      );
      setTimeout(() => setActionSuccessMessage(null), 5000);
    }

    setIsTerminating(false);
    setIsTerminateModalOpen(false);
  };

  // Terminate ALL rogue nodes bulk action
  const handleTerminateAllRogue = async () => {
    const rogueNodes = instances.filter((i) => i.isRogueMinerFlagged && i.status !== "terminated");
    for (const node of rogueNodes) {
      await terminateComputeInstance(node.id, "Automated Bulk Security Purge: Rogue Miner", "Hackathon Security Bot");
    }

    setInstances((prev) =>
      prev.map((i) =>
        i.isRogueMinerFlagged
          ? {
              ...i,
              status: "terminated",
              isRogueMinerFlagged: false,
              currentTelemetry: { ...i.currentTelemetry, cpuUtilizationPercent: 0, temperatureCelsius: 22 },
            }
          : i
      )
    );

    setActionSuccessMessage(`Purged ${rogueNodes.length} rogue mining instance(s) from the cluster.`);
    setTimeout(() => setActionSuccessMessage(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Station */}
      <div className="neu-border bg-white p-6 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-lime dark:bg-lime-400">
                <Server className="h-5 w-5 text-black" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Hardware Resource Telemetry Station
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Live CloudWatch Metric Streams, Crypto-Mining Anomaly Heuristics & AWS EC2 Kill Switches • {eventTitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLiveSimulating((prev) => !prev)}
              className={`neu-border flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${
                isLiveSimulating
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-500"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <Activity className={`h-3.5 w-3.5 ${isLiveSimulating ? "animate-spin text-emerald-600" : ""}`} />
              {isLiveSimulating ? "Live Stream (4s)" : "Paused"}
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => exportHardwareAuditCSV(instances, clusterMetrics)}
              className="neu-border flex items-center gap-1.5 bg-lime font-mono text-xs font-bold uppercase text-black hover:bg-lime/80"
            >
              <Download className="h-3.5 w-3.5" />
              Export Cloud Audit CSV
            </Button>
          </div>
        </div>

        {/* Global Action Success Toast */}
        {actionSuccessMessage && (
          <div className="neu-border mt-4 flex items-center gap-2 bg-emerald-100 p-3 text-xs font-mono font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{actionSuccessMessage}</span>
          </div>
        )}

        {/* Emergency Threat Banner if Rogue Miner detected */}
        {clusterMetrics.flaggedRogueNodes > 0 && (
          <div className="neu-border mt-4 flex flex-col gap-3 border-rose-600 bg-rose-50 p-4 dark:border-rose-700 dark:bg-rose-950/50 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-7 w-7 text-rose-600 animate-bounce" />
              <div>
                <span className="font-mono text-xs font-black uppercase text-rose-900 dark:text-rose-200">
                  🚨 Rogue Crypto-Mining Threat Detected ({clusterMetrics.flaggedRogueNodes} Node Flagged)
                </span>
                <p className="font-mono text-xs text-rose-700 dark:text-rose-300">
                  Instance is maxing CPU at ~99% running unapproved hash processes (<code className="bg-rose-200 px-1 py-0.5 rounded text-[10px] text-rose-950">xmrig</code>). Terminate immediately to avoid cloud overcharges.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleTerminateAllRogue}
              className="neu-border bg-rose-600 font-mono text-xs font-black uppercase text-white hover:bg-rose-700 shadow-[4px_4px_0_0_#000]"
            >
              <Power className="h-3.5 w-3.5 mr-1" />
              Terminate Rogue Instance
            </Button>
          </div>
        )}

        {/* High-Level Cluster Metrics Bar */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Active Compute Nodes
            </span>
            <div className="mt-1 font-mono text-xl font-black text-zinc-900 dark:text-white">
              {clusterMetrics.activeOnlineNodes} / {clusterMetrics.totalProvisionedNodes}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              {clusterMetrics.terminatedNodes} Decommissioned
            </span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Allocated vCPU Cores
            </span>
            <div className="mt-1 font-mono text-xl font-black text-blue-600 dark:text-blue-400">
              {clusterMetrics.totalAllocatedvCpuCores} Cores
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              {clusterMetrics.averageClusterCpuPercent}% Avg Load
            </span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Dedicated Cloud GPUs
            </span>
            <div className="mt-1 font-mono text-xl font-black text-purple-600 dark:text-purple-400">
              {clusterMetrics.totalAllocatedGpuCount} GPUs
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Nvidia T4 / A100</span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Total Memory (RAM)
            </span>
            <div className="mt-1 font-mono text-xl font-black text-zinc-900 dark:text-white">
              {clusterMetrics.totalAllocatedRamGb} GB
            </div>
            <span className="font-mono text-[10px] text-zinc-500">ECC Registered</span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Hourly Burn Rate
            </span>
            <div className="mt-1 font-mono text-xl font-black text-amber-600 dark:text-amber-400">
              ${clusterMetrics.totalBurnRateUsdPerHour}/hr
            </div>
            <span className="font-mono text-[10px] text-zinc-500">AWS On-Demand</span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Budget Consumed
            </span>
            <div className="mt-1 font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
              ${clusterMetrics.totalAccumulatedSpendUsd}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              {clusterMetrics.budgetUtilizationPercent}% of ${clusterMetrics.totalEventBudgetUsd}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation: Grid View vs Cost & Carbon Analytics */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="neu-border grid w-full max-w-md grid-cols-2 bg-white p-1 dark:bg-zinc-900">
          <TabsTrigger
            value="nodes"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-lime dark:data-[state=active]:text-black"
          >
            Compute Fleet Grid ({filteredInstances.length})
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-lime dark:data-[state=active]:text-black"
          >
            Cost & Sustainability Analytics
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Compute Fleet Grid */}
        <TabsContent value="nodes" className="mt-4 space-y-4">
          {/* Filter & Search Toolbar */}
          <div className="neu-border flex flex-col gap-3 bg-white p-4 dark:bg-zinc-900 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search instance ID, team, lead..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="neu-border w-full bg-zinc-50 py-1.5 pl-8 pr-3 font-mono text-xs text-zinc-900 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <select
                aria-label="Filter Instance Type"
                value={nodeTypeFilter}
                onChange={(e) => setNodeTypeFilter(e.target.value)}
                className="neu-border bg-zinc-50 py-1.5 px-2.5 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
              >
                <option value="all">All Instance Types</option>
                <option value="aws_ec2_c5_xlarge">Compute (c5.xlarge)</option>
                <option value="aws_ec2_g4dn_xlarge">GPU ML (g4dn.xlarge)</option>
                <option value="aws_ec2_t3_medium">Burstable (t3.medium)</option>
                <option value="aws_ec2_r5_2xlarge">Memory (r5.2xlarge)</option>
                <option value="edge_raspberry_pi">Raspberry Pi Edge</option>
              </select>

              <select
                aria-label="Filter Instance Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="neu-border bg-zinc-50 py-1.5 px-2.5 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
              >
                <option value="all">All Health States</option>
                <option value="healthy">Healthy</option>
                <option value="warning_high_load">Warning (High Load)</option>
                <option value="critical_rogue_miner">Rogue Crypto Miner</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowOnlyMiners((prev) => !prev)}
              className={`neu-border flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${
                showOnlyMiners
                  ? "bg-rose-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              Rogue Miners Only ({clusterMetrics.flaggedRogueNodes})
            </button>
          </div>

          {/* Grid of Nodes */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredInstances.map((node) => {
              const spec = NODE_TYPE_SPECS[node.nodeType];
              const isTerminated = node.status === "terminated";
              const isRogue = node.isRogueMinerFlagged && !isTerminated;
              const cpu = node.currentTelemetry.cpuUtilizationPercent;
              const temp = node.currentTelemetry.temperatureCelsius;

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedInstanceId(node.id)}
                  className={`neu-border relative cursor-pointer p-4 transition-all duration-150 hover:shadow-[4px_4px_0_0_#000] ${
                    isRogue
                      ? "border-rose-600 bg-rose-50/90 dark:border-rose-700 dark:bg-rose-950/40 ring-2 ring-rose-500 animate-pulse"
                      : isTerminated
                      ? "opacity-50 bg-zinc-100 dark:bg-zinc-900/60"
                      : cpu > 80
                      ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-500"
                      : "bg-white dark:bg-zinc-900"
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between gap-1 border-b border-zinc-200 pb-2 dark:border-zinc-800">
                    <span className="font-mono text-[10px] font-black uppercase text-zinc-500">
                      {node.id}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-black uppercase ${
                        isRogue
                          ? "bg-rose-600 text-white animate-bounce"
                          : isTerminated
                          ? "bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300"
                          : cpu > 80
                          ? "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200"
                          : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                      }`}
                    >
                      {isRogue ? "ROGUE MINER" : node.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Team Name & Lead */}
                  <div className="my-2.5">
                    <h4 className="font-mono text-xs font-black truncate text-zinc-900 dark:text-white">
                      {node.assignedTeamName}
                    </h4>
                    <p className="font-mono text-[10px] text-zinc-500 truncate">
                      {spec.label} • {node.assignedStudentLead}
                    </p>
                  </div>

                  {/* Real-time Telemetry Metrics Bars */}
                  <div className="space-y-2 font-mono text-[11px]">
                    <div>
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-zinc-500">CPU Usage:</span>
                        <span
                          className={`font-black ${
                            cpu > 90 ? "text-rose-600" : cpu > 70 ? "text-amber-600" : "text-emerald-600"
                          }`}
                        >
                          {cpu}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden dark:bg-zinc-800 mt-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            cpu > 90 ? "bg-rose-600" : cpu > 70 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${cpu}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-[10px] text-zinc-600 dark:text-zinc-400">
                      <span>RAM: {node.currentTelemetry.ramUsagePercent}%</span>
                      <span>Temp: {temp}°C</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-2 font-mono text-[10px] text-zinc-500 dark:border-zinc-800">
                    <span>{node.publicIp}</span>
                    <span className="font-bold text-zinc-900 dark:text-white">
                      ${node.totalAccumulatedCostUsd} spent
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 2: Cost & Sustainability Analytics */}
        <TabsContent value="analytics" className="mt-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Spot Savings Card */}
            <div className="neu-border bg-white p-6 dark:bg-zinc-900">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="h-5 w-5 text-emerald-600" />
                <h3 className="font-mono text-sm font-black uppercase text-zinc-900 dark:text-white">
                  AWS Spot vs On-Demand Arbitrage
                </h3>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
                  <span className="text-zinc-500">On-Demand Cluster Rate:</span>
                  <span className="font-bold text-zinc-900 dark:text-white">
                    ${spotSavings.onDemandHourlyCost}/hr
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
                  <span className="text-zinc-500">Spot Negotiated Rate:</span>
                  <span className="font-bold text-emerald-600">
                    ${spotSavings.spotHourlyCost}/hr (-{spotSavings.percentageSavings}%)
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
                  <span className="text-zinc-500">Projected Weekend Savings:</span>
                  <span className="font-black text-emerald-600">
                    +${spotSavings.projectedWeekendSavingsUsd} Saved
                  </span>
                </div>
              </div>
            </div>

            {/* Cloud Carbon Footprint */}
            <div className="neu-border bg-white p-6 dark:bg-zinc-900">
              <div className="flex items-center gap-2 mb-4">
                <Leaf className="h-5 w-5 text-emerald-600" />
                <h3 className="font-mono text-sm font-black uppercase text-zinc-900 dark:text-white">
                  Compute Carbon Footprint Telemetry
                </h3>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
                  <span className="text-zinc-500">Total Energy Consumed:</span>
                  <span className="font-bold text-zinc-900 dark:text-white">
                    {carbonMetrics.totalKwhConsumed} kWh
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
                  <span className="text-zinc-500">CO₂ Emissions Generated:</span>
                  <span className="font-bold text-amber-600">
                    {carbonMetrics.co2EmissionsKg} kg ({carbonMetrics.co2EmissionsPounds} lbs)
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
                  <span className="text-zinc-500">Equivalent Car Miles:</span>
                  <span className="font-bold text-zinc-900 dark:text-white">
                    ~{carbonMetrics.equivalentCarMiles} passenger miles
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Node Inspector Drawer / Dialog */}
      <Dialog
        open={Boolean(selectedInstance)}
        onOpenChange={(open) => !open && setSelectedInstanceId(null)}
      >
        <DialogContent className="neu-border max-w-3xl bg-white p-6 dark:bg-zinc-900">
          {selectedInstance && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-blue-600" />
                    <DialogTitle className="text-xl font-black uppercase text-zinc-900 dark:text-white">
                      Node Inspector: {selectedInstance.id}
                    </DialogTitle>
                  </div>

                  <span
                    className={`rounded px-2 py-0.5 font-mono text-xs font-black uppercase ${
                      selectedInstance.isRogueMinerFlagged
                        ? "bg-rose-600 text-white"
                        : "bg-emerald-100 text-emerald-900"
                    }`}
                  >
                    {selectedInstance.status.replace(/_/g, " ")}
                  </span>
                </div>
                <DialogDescription className="font-mono text-xs text-zinc-500">
                  {selectedInstance.assignedTeamName} • Lead: {selectedInstance.assignedStudentLead} (
                  {selectedInstance.assignedStudentEmail})
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4 font-mono text-xs">
                {/* Instance Specifications Bar */}
                <div className="grid grid-cols-2 gap-2 rounded border-2 border-black bg-zinc-50 p-3 dark:bg-zinc-800 md:grid-cols-4">
                  <div>
                    <span className="font-mono text-[10px] uppercase text-zinc-500">Node Type</span>
                    <p className="font-bold text-zinc-900 dark:text-white">
                      {NODE_TYPE_SPECS[selectedInstance.nodeType].label}
                    </p>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase text-zinc-500">Public IP / Region</span>
                    <p className="font-bold text-zinc-900 dark:text-white">
                      {selectedInstance.publicIp} ({selectedInstance.region})
                    </p>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase text-zinc-500">Hourly Cloud Cost</span>
                    <p className="font-bold text-amber-600 dark:text-amber-400">
                      ${NODE_TYPE_SPECS[selectedInstance.nodeType].hourlyCostUsd} / hr
                    </p>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase text-zinc-500">Uptime & Total Spend</span>
                    <p className="font-bold text-emerald-600">
                      {selectedInstance.uptimeHours} hrs (${selectedInstance.totalAccumulatedCostUsd})
                    </p>
                  </div>
                </div>

                {/* Top Processes Snapshot */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-bold uppercase text-zinc-800 dark:text-zinc-200">
                      Live Running OS Processes ({selectedInstance.topProcesses.length})
                    </h5>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsProcessModalOpen(true)}
                      className="neu-border font-mono text-[10px] font-bold uppercase"
                    >
                      <Terminal className="h-3 w-3 mr-1" /> Open Process Supervisor
                    </Button>
                  </div>

                  <div className="neu-border overflow-hidden bg-zinc-900 text-zinc-100">
                    <table className="w-full text-left font-mono text-[11px]">
                      <thead className="border-b border-zinc-700 bg-zinc-800/80">
                        <tr>
                          <th className="p-2">PID</th>
                          <th className="p-2">Process</th>
                          <th className="p-2">Command Line</th>
                          <th className="p-2 text-right">CPU %</th>
                          <th className="p-2 text-center">Threat Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {selectedInstance.topProcesses.map((proc) => (
                          <tr
                            key={proc.pid}
                            className={proc.isSuspicious ? "bg-rose-950/60 text-rose-200" : ""}
                          >
                            <td className="p-2 font-bold">{proc.pid}</td>
                            <td className="p-2 font-black">{proc.processName}</td>
                            <td className="p-2 truncate max-w-xs">{proc.commandLine}</td>
                            <td className="p-2 text-right font-black">{proc.cpuPercent}%</td>
                            <td className="p-2 text-center">
                              {proc.isSuspicious ? (
                                <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                                  {proc.threatClassification || "MALICIOUS MINER"}
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-400">Normal</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Kill Switch & Emergency Actions */}
                <div className="flex flex-wrap items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <div className="text-[11px] text-zinc-500">
                    {selectedInstance.status === "terminated"
                      ? "Node has been decommissioned."
                      : "Executing termination sends direct AWS EC2 TerminateInstance API request."}
                  </div>

                  {selectedInstance.status !== "terminated" && (
                    <Button
                      onClick={() => setIsTerminateModalOpen(true)}
                      className="neu-border bg-rose-600 font-mono text-xs font-black uppercase text-white hover:bg-rose-700 shadow-[4px_4px_0_0_#000]"
                    >
                      <Power className="h-4 w-4 mr-1.5" /> Kill Instance (AWS Terminate)
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Kill Switch Modal */}
      <Dialog open={isTerminateModalOpen} onOpenChange={setIsTerminateModalOpen}>
        <DialogContent className="neu-border max-w-md bg-white p-6 dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase text-rose-600">
              <AlertTriangle className="h-6 w-6" /> Confirm AWS EC2 Kill Switch
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
              Are you sure you want to permanently terminate compute node{" "}
              <strong>{selectedInstance?.id}</strong> assigned to team{" "}
              <strong>{selectedInstance?.assignedTeamName}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 rounded bg-rose-50 p-3 font-mono text-xs text-rose-900 dark:bg-rose-950 dark:text-rose-200">
            ⚠️ This will immediately shut down the virtual machine and stop all cloud billing. Any
            active crypto-mining software will be destroyed.
          </div>

          <div className="mt-6 flex justify-end gap-2 font-mono text-xs">
            <Button
              variant="outline"
              onClick={() => setIsTerminateModalOpen(false)}
              className="neu-border"
            >
              Cancel
            </Button>
            <Button
              disabled={isTerminating}
              onClick={handleConfirmTerminate}
              className="neu-border bg-rose-600 font-black uppercase text-white hover:bg-rose-700"
            >
              {isTerminating ? "Terminating..." : "Yes, Kill Instance"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Granular Process Supervisor Modal */}
      <InstanceProcessManagerModal
        instance={selectedInstance}
        isOpen={isProcessModalOpen}
        onClose={() => setIsProcessModalOpen(false)}
      />
    </div>
  );
};

export default HardwareResourceDashboard;
