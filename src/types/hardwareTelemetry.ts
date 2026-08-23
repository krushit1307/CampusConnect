// =============================================================================
// File: src/types/hardwareTelemetry.ts
// Issue: #4304 - Build a 'Real-Time "Hardware Resource" Status Dashboard'
// Description: Type definitions for cloud compute instances, real-time AWS EC2
//              telemetry metrics, rogue crypto-mining anomaly detection, and node lifecycle.
// =============================================================================

export type InstanceNodeType =
  | "aws_ec2_c5_xlarge" // Compute optimized
  | "aws_ec2_g4dn_xlarge" // GPU Nvidia T4 for AI/ML Hackathons
  | "aws_ec2_t3_medium" // General purpose microservice
  | "aws_ec2_r5_2xlarge" // Memory optimized
  | "edge_raspberry_pi" // Embedded IoT board
  | "k8s_gpu_worker"; // Kubernetes cluster pod

export type InstanceHealthStatus =
  | "healthy"
  | "warning_high_load"
  | "critical_rogue_miner"
  | "throttled"
  | "terminating"
  | "terminated"
  | "stopped";

export interface TelemetryDataPoint {
  timestamp: string; // ISO 8601 string
  cpuUtilizationPercent: number; // 0.0 - 100.0%
  ramUsagePercent: number; // 0.0 - 100.0%
  gpuUtilizationPercent?: number; // 0.0 - 100.0%
  gpuMemoryUsedMb?: number;
  gpuMemoryTotalMb?: number;
  networkInKbps: number;
  networkOutKbps: number;
  diskIoIops: number;
  temperatureCelsius: number;
  estimatedHourlyCostUsd: number;
  anomalyScore: number; // 0.0 (benign) to 1.0 (malicious cryptominer)
}

export interface RunningProcessItem {
  pid: number;
  processName: string;
  commandLine: string;
  cpuPercent: number;
  memoryMb: number;
  isSuspicious: boolean;
  threatClassification?: "CRYPTO_MINER_XMRIG" | "DDOS_FLOODER" | "MODEL_TRAINING" | "BENIGN";
}

export interface CloudInstanceNode {
  id: string; // e.g. "i-09f4b7a1e2c3d4e5f"
  instanceName: string;
  assignedTeamId: string;
  assignedTeamName: string;
  assignedStudentLead: string;
  assignedStudentEmail: string;
  eventId: string;
  eventTitle: string;
  nodeType: InstanceNodeType;
  region: string; // e.g. "us-east-1"
  availabilityZone: string; // e.g. "us-east-1a"
  publicIp: string;
  privateIp: string;
  status: InstanceHealthStatus;
  launchTime: string;
  uptimeHours: number;
  totalAccumulatedCostUsd: number;
  currentTelemetry: TelemetryDataPoint;
  historicalTelemetry: TelemetryDataPoint[]; // Last 15-30 time samples
  topProcesses: RunningProcessItem[];
  sustainedHighCpuMinutes: number;
  isRogueMinerFlagged: boolean;
  isolationFirewallActive: boolean;
}

export interface ClusterSummaryMetrics {
  totalProvisionedNodes: number;
  activeOnlineNodes: number;
  flaggedRogueNodes: number;
  terminatedNodes: number;
  totalAllocatedvCpuCores: number;
  totalAllocatedGpuCount: number;
  totalAllocatedRamGb: number;
  totalBurnRateUsdPerHour: number;
  totalEventBudgetUsd: number;
  totalAccumulatedSpendUsd: number;
  projectedWeekendSpendUsd: number;
  budgetUtilizationPercent: number;
  averageClusterCpuPercent: number;
  averageClusterGpuPercent: number;
}

export interface HardwareDashboardFilterState {
  searchQuery: string;
  statusFilter: "all" | InstanceHealthStatus;
  nodeTypeFilter: "all" | InstanceNodeType;
  sortBy: "cpu_desc" | "anomaly_desc" | "cost_desc" | "uptime_desc" | "name_asc";
  showOnlyFlaggedMiners: boolean;
}

export interface InstanceActionLog {
  id: string;
  instanceId: string;
  action: "terminate" | "reboot" | "throttle" | "quarantine_network" | "dismiss_alert";
  executedBy: string;
  timestamp: string;
  reason: string;
  costSavedEstimateUsd: number;
  success: boolean;
}
