// =============================================================================
// Component: AutoGraderMonitorDashboard
// Issue: #5131 - Automated "Event Series" GitHub Classroom Auto-Grader Load Balancer
// Description: Real-time telemetry dashboard monitoring AWS SQS queue depth, EKS worker pods,
// EC2 Spot instances, DLQ routing, and 500-submission spike load test simulation.
// =============================================================================

import React, { useState, useEffect } from "react";
import {
  Cpu,
  Server,
  Layers,
  Zap,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Play,
  Activity,
} from "lucide-react";
import { globalSqsGraderQueueService } from "@/services/sqsGraderQueueService";
import { AutoGraderWorkerService } from "@/services/autoGraderWorkerService";
import { QueueMetrics, GradingResultPayload } from "@/types/autoGraderLoadBalancer";

export interface AutoGraderMonitorDashboardProps {
  className?: string;
}

export const AutoGraderMonitorDashboard: React.FC<AutoGraderMonitorDashboardProps> = ({
  className = "",
}) => {
  const [metrics, setMetrics] = useState<QueueMetrics>(() =>
    globalSqsGraderQueueService.getMetrics(),
  );
  const [processedResults, setProcessedResults] = useState<GradingResultPayload[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [activeWorker] = useState(() => new AutoGraderWorkerService("pod_worker_node_alpha"));

  const refreshMetrics = () => {
    setMetrics(globalSqsGraderQueueService.getMetrics());
  };

  useEffect(() => {
    refreshMetrics();
    const timer = setInterval(refreshMetrics, 3000);
    return () => clearInterval(timer);
  }, []);

  // Simulate 500 Simultaneous Submissions Deadline Spike
  const handleSimulate500Spike = () => {
    setIsSimulating(true);
    globalSqsGraderQueueService.simulateSubmissionSpike(500, "series-cs101-2026");
    refreshMetrics();
    setIsSimulating(false);
  };

  // Run Worker Node Batch Processing
  const handleProcessWorkerBatch = async () => {
    const results = await activeWorker.processNextBatch(10);
    setProcessedResults((prev) => [...results, ...prev].slice(0, 20));
    refreshMetrics();
  };

  return (
    <div
      data-testid="auto-grader-monitor-dashboard"
      className={`rounded-3xl bg-slate-900 border border-indigo-500/30 p-6 shadow-2xl space-y-6 text-slate-100 relative overflow-hidden ${className}`}
    >
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Cpu className="w-7 h-7 text-indigo-400 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                AWS SQS + EKS SPOT LOAD BALANCER ⚡
              </span>
              <span className="text-xs text-slate-400 font-mono">500 Submission Capacity</span>
            </div>
            <h2 className="text-lg font-bold text-white mt-0.5">
              GitHub Classroom Auto-Grader Telemetry
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshMetrics}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Metric 1: SQS Queue Depth */}
        <div
          data-testid="metric-queue-depth"
          className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1"
        >
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>SQS Queue Depth</span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-300">{metrics.queueDepth}</div>
          <div className="text-[11px] text-slate-500">Pending submissions</div>
        </div>

        {/* Metric 2: Messages In Flight */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>In Flight</span>
          </div>
          <div className="text-2xl font-black font-mono text-indigo-300">
            {metrics.messagesInFlight}
          </div>
          <div className="text-[11px] text-slate-500">Active docker runs</div>
        </div>

        {/* Metric 3: Active Worker Pods */}
        <div
          data-testid="metric-worker-pods"
          className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1"
        >
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>Worker Pods (HPA)</span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-300">
            {metrics.activeWorkerPods}{" "}
            <span className="text-xs text-slate-500 font-normal">/ 50</span>
          </div>
          <div className="text-[11px] text-slate-500">Autoscaled EKS pods</div>
        </div>

        {/* Metric 4: EC2 Spot Nodes */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span>Spot EC2 Nodes</span>
          </div>
          <div className="text-2xl font-black font-mono text-yellow-300">
            {metrics.spotNodesAllocated}
          </div>
          <div className="text-[11px] text-slate-500">Cheap compute nodes</div>
        </div>
      </div>

      {/* Action Controls & Spike Simulation */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-0.5 text-xs">
          <div className="font-bold text-white flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Load Test Simulator (500 Submissions Deadline Spike)</span>
          </div>
          <p className="text-slate-400">
            Enqueues 500 simultaneous GitHub Classroom submissions to test SQS queueing & HPA
            autoscaling.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleSimulate500Spike}
            disabled={isSimulating}
            data-testid="simulate-500-spike-btn"
            className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition shadow-md shadow-amber-600/30 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            <span>Simulate 500 Spike 🚀</span>
          </button>

          <button
            onClick={handleProcessWorkerBatch}
            data-testid="process-worker-batch-btn"
            className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95"
          >
            <Cpu className="w-4 h-4" />
            <span>Run Worker Batch</span>
          </button>
        </div>
      </div>

      {/* Processed Results Table */}
      {processedResults.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
            <span>Recent Worker Pod Execution Results</span>
            <span className="text-indigo-400 font-mono">Pod: {activeWorker.getWorkerPodId()}</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="p-3">Submission ID</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Exec Time</th>
                  <th className="p-3">Worker Pod</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-slate-200">
                {processedResults.map((r) => (
                  <tr key={r.submissionId} className="hover:bg-slate-900/50">
                    <td className="p-3 font-bold text-indigo-300">{r.submissionId}</td>
                    <td className="p-3">{r.studentHandle}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.status === "PASSED"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3">{r.executionTimeMs}ms</td>
                    <td className="p-3 text-slate-400">{r.workerPodId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoGraderMonitorDashboard;
