// =============================================================================
// File: src/services/hardwareCostForecaster.ts
// Issue: #4304 - Build a 'Real-Time "Hardware Resource" Status Dashboard'
// Description: Multi-cloud financial forecasting, Spot vs On-Demand cost optimization,
//              budget depletion time estimators, and carbon emission analytics.
// =============================================================================

import type {
  CloudInstanceNode,
  ClusterSummaryMetrics,
  InstanceNodeType,
} from "@/types/hardwareTelemetry";
import { NODE_TYPE_SPECS } from "@/services/hardwareTelemetryService";

export interface SpotSavingsComparison {
  onDemandHourlyCost: number;
  spotHourlyCost: number;
  hourlySavingsUsd: number;
  percentageSavings: number;
  projectedWeekendSavingsUsd: number;
}

export interface CloudCarbonFootprint {
  totalKwhConsumed: number;
  co2EmissionsKg: number;
  co2EmissionsPounds: number;
  equivalentCarMiles: number;
}

export interface BudgetForecastModel {
  currentSpendUsd: number;
  totalBudgetUsd: number;
  remainingBudgetUsd: number;
  currentBurnRatePerHourUsd: number;
  hoursUntilBudgetExhausted: number;
  projectedOverspendUsd: number;
  isRiskOfBudgetExhaustion: boolean;
  recommendedAction: "MAINTAIN" | "THROTTLE_UNAPPROVED_NODES" | "TERMINATE_IMMEDIATELY";
}

/**
 * Calculates Spot vs On-Demand compute price advantages for student hackathons.
 * AWS EC2 Spot instances typically yield 65-72% cost reductions.
 */
export function calculateSpotSavings(instances: CloudInstanceNode[]): SpotSavingsComparison {
  let onDemandHourlySum = 0;

  instances.forEach((inst) => {
    if (inst.status !== "terminated") {
      const spec = NODE_TYPE_SPECS[inst.nodeType];
      onDemandHourlySum += spec.hourlyCostUsd;
    }
  });

  // Typical Spot discount factor is ~0.32 (68% savings)
  const spotDiscountFactor = 0.32;
  const spotHourlySum = onDemandHourlySum * spotDiscountFactor;
  const hourlySavings = onDemandHourlySum - spotHourlySum;
  const weekendSavings = hourlySavings * 48; // 48 hour weekend hackathon

  return {
    onDemandHourlyCost: Number(onDemandHourlySum.toFixed(2)),
    spotHourlyCost: Number(spotHourlySum.toFixed(2)),
    hourlySavingsUsd: Number(hourlySavings.toFixed(2)),
    percentageSavings: 68.0,
    projectedWeekendSavingsUsd: Number(weekendSavings.toFixed(2)),
  };
}

/**
 * Calculates energy consumption and carbon emissions for the active cloud compute cluster.
 * Average cloud server uses ~0.025 kWh per vCPU-hour (PUE = 1.15 in modern AWS datacenters).
 */
export function calculateComputeCarbonFootprint(
  instances: CloudInstanceNode[],
  elapsedHours: number = 14.0
): CloudCarbonFootprint {
  let totalvCpus = 0;
  let totalGpus = 0;

  instances.forEach((inst) => {
    if (inst.status !== "terminated") {
      const spec = NODE_TYPE_SPECS[inst.nodeType];
      totalvCpus += spec.vCpuCores;
      totalGpus += spec.gpuCount;
    }
  });

  // Energy coefficients (kWh per core-hour)
  const vCpuKwhPerHour = 0.025;
  const gpuKwhPerHour = 0.25; // Nvidia T4 / A100 power envelope

  const totalKwh =
    (totalvCpus * vCpuKwhPerHour + totalGpus * gpuKwhPerHour) * elapsedHours * 1.15; // PUE factor

  // US Grid standard: 0.85 lbs CO2 per kWh (0.386 kg CO2 per kWh)
  const co2Kg = totalKwh * 0.386;
  const co2Lbs = co2Kg * 2.20462;
  const equivalentMiles = co2Kg / 0.404; // 404g CO2 per car mile

  return {
    totalKwhConsumed: Number(totalKwh.toFixed(1)),
    co2EmissionsKg: Number(co2Kg.toFixed(2)),
    co2EmissionsPounds: Number(co2Lbs.toFixed(1)),
    equivalentCarMiles: Number(equivalentMiles.toFixed(0)),
  };
}

/**
 * Real-time Budget Burn & Depletion Forecasting Engine.
 * Predicts the exact hour when the hackathon AWS credit limit will be breached.
 */
export function forecastBudgetDepletion(
  metrics: ClusterSummaryMetrics,
  remainingHackathonHours: number = 36.0
): BudgetForecastModel {
  const remainingBudget = Math.max(0, metrics.totalEventBudgetUsd - metrics.totalAccumulatedSpendUsd);
  const burnRate = metrics.totalBurnRateUsdPerHour;

  let hoursUntilDepleted = 999;
  if (burnRate > 0) {
    hoursUntilDepleted = Number((remainingBudget / burnRate).toFixed(1));
  }

  const projectedTotalSpend = metrics.totalAccumulatedSpendUsd + burnRate * remainingHackathonHours;
  const projectedOverspend = Math.max(0, projectedTotalSpend - metrics.totalEventBudgetUsd);
  const isRisk = hoursUntilDepleted < remainingHackathonHours;

  let recommendedAction: BudgetForecastModel["recommendedAction"] = "MAINTAIN";
  if (projectedOverspend > 150) {
    recommendedAction = "TERMINATE_IMMEDIATELY";
  } else if (isRisk) {
    recommendedAction = "THROTTLE_UNAPPROVED_NODES";
  }

  return {
    currentSpendUsd: metrics.totalAccumulatedSpendUsd,
    totalBudgetUsd: metrics.totalEventBudgetUsd,
    remainingBudgetUsd: Number(remainingBudget.toFixed(2)),
    currentBurnRatePerHourUsd: burnRate,
    hoursUntilBudgetExhausted: hoursUntilDepleted,
    projectedOverspendUsd: Number(projectedOverspend.toFixed(2)),
    isRiskOfBudgetExhaustion: isRisk,
    recommendedAction,
  };
}

/**
 * Generates an automated JSON webhook alert payload formatted for Discord / Slack / PagerDuty
 * when a rogue compute miner is flagged.
 */
export function generateSecurityWebhookPayload(
  instance: CloudInstanceNode,
  reason: string
): Record<string, any> {
  return {
    eventType: "SECURITY_ALERT_ROGUE_MINER",
    severity: "CRITICAL",
    timestamp: new Date().toISOString(),
    instanceDetails: {
      awsInstanceId: instance.id,
      instanceName: instance.instanceName,
      nodeType: instance.nodeType,
      publicIp: instance.publicIp,
      region: instance.region,
      assignedTeam: instance.assignedTeamName,
      studentLead: `${instance.assignedStudentLead} <${instance.assignedStudentEmail}>`,
      currentCpuPercent: instance.currentTelemetry.cpuUtilizationPercent,
      sustainedMinutes: instance.sustainedHighCpuMinutes,
      threatClassification: "UNAUTHORIZED_MONERO_MINING_XMRIG",
    },
    actionRecommended: "EXECUTE_AWS_EC2_TERMINATE_KILL_SWITCH",
    alertReason: reason,
    webhookEmbed: {
      title: `🚨 Rogue Crypto Miner Detected: ${instance.id}`,
      description: `Compute instance assigned to **${instance.assignedTeamName}** is consuming **${instance.currentTelemetry.cpuUtilizationPercent}% CPU** executing unauthorized hashing binaries.`,
      color: 15158332, // Red
      fields: [
        { name: "Public IP", value: instance.publicIp, inline: true },
        { name: "Sustained Time", value: `${instance.sustainedHighCpuMinutes} mins`, inline: true },
        { name: "Hourly Cost Waste", value: `$${instance.currentTelemetry.estimatedHourlyCostUsd}/hr`, inline: true },
      ],
    },
  };
}
