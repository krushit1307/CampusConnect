// =============================================================================
// File: src/components/hardware/InstanceProcessManagerModal.tsx
// Issue: #4304 - Build a 'Real-Time "Hardware Resource" Status Dashboard'
// Description: Interactive OS process inspector, network socket monitor,
//              and granular PID killer for hackathon compute instances.
// =============================================================================

import React, { useState } from "react";
import {
  Terminal,
  Activity,
  AlertTriangle,
  Flame,
  Shield,
  Search,
  X,
  Play,
  Square,
  RefreshCw,
  Download,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { CloudInstanceNode, RunningProcessItem } from "@/types/hardwareTelemetry";

interface InstanceProcessManagerModalProps {
  instance: CloudInstanceNode | null;
  isOpen: boolean;
  onClose: () => void;
  onKillProcess?: (pid: number) => void;
  onIsolateNetwork?: (instanceId: string) => void;
}

export const InstanceProcessManagerModal: React.FC<InstanceProcessManagerModalProps> = ({
  instance,
  isOpen,
  onClose,
  onKillProcess,
  onIsolateNetwork,
}) => {
  const [filterSearch, setFilterSearch] = useState("");
  const [killedPids, setKilledPids] = useState<Set<number>>(new Set());
  const [isQuarantined, setIsQuarantined] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  if (!instance) return null;

  const handleKillPid = (pid: number, processName: string) => {
    setKilledPids((prev) => new Set(prev).add(pid));
    onKillProcess?.(pid);
    setActionFeedback(`SIGKILL signal dispatched to PID ${pid} (${processName}).`);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleToggleQuarantine = () => {
    setIsQuarantined((prev) => !prev);
    onIsolateNetwork?.(instance.id);
    setActionFeedback(
      !isQuarantined
        ? "Network Security Group updated: Outbound stratum & mining pool traffic quarantined."
        : "Network Security Group restored to default student VPC."
    );
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const filteredProcesses = instance.topProcesses.filter((proc) => {
    if (killedPids.has(proc.pid)) return false;
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      return (
        proc.processName.toLowerCase().includes(q) ||
        proc.commandLine.toLowerCase().includes(q) ||
        proc.pid.toString().includes(q)
      );
    }
    return true;
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="neu-border max-w-4xl bg-white p-6 dark:bg-zinc-900">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-blue-600" />
              <DialogTitle className="text-xl font-black uppercase text-zinc-900 dark:text-white">
                Live OS Process Supervisor • {instance.id}
              </DialogTitle>
            </div>
            <span className="font-mono text-xs font-bold text-zinc-500">
              {instance.assignedTeamName} ({instance.publicIp})
            </span>
          </div>
          <DialogDescription className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
            Real-time PID inspection, command line argument audit, and kernel kill signals.
          </DialogDescription>
        </DialogHeader>

        {actionFeedback && (
          <div className="neu-border mt-3 flex items-center gap-2 bg-emerald-100 p-2.5 font-mono text-xs font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{actionFeedback}</span>
          </div>
        )}

        <div className="mt-4 space-y-4 font-mono text-xs">
          {/* Top Action Bar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Filter PID or binary..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="neu-border w-full bg-zinc-50 py-1.5 pl-8 pr-3 font-mono text-xs text-zinc-900 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleToggleQuarantine}
                className={`neu-border flex items-center gap-1.5 font-mono text-xs font-bold uppercase ${
                  isQuarantined
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 hover:bg-amber-200"
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                {isQuarantined ? "Quarantine Active" : "Isolate Network VPC"}
              </Button>
            </div>
          </div>

          {/* Process Table */}
          <div className="neu-border max-h-80 overflow-y-auto bg-zinc-950 text-zinc-100">
            <table className="w-full text-left font-mono text-xs">
              <thead className="sticky top-0 border-b border-zinc-800 bg-zinc-900">
                <tr>
                  <th className="p-2.5">PID</th>
                  <th className="p-2.5">Binary</th>
                  <th className="p-2.5">Command Line Arguments</th>
                  <th className="p-2.5 text-right">CPU %</th>
                  <th className="p-2.5 text-right">RAM (MB)</th>
                  <th className="p-2.5 text-center">Threat Class</th>
                  <th className="p-2.5 text-center">Signal Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {filteredProcesses.map((proc) => (
                  <tr
                    key={proc.pid}
                    className={
                      proc.isSuspicious
                        ? "bg-rose-950/70 text-rose-200 font-bold"
                        : "hover:bg-zinc-900/60"
                    }
                  >
                    <td className="p-2.5">{proc.pid}</td>
                    <td className="p-2.5 font-black">{proc.processName}</td>
                    <td className="p-2.5 font-mono text-[11px] truncate max-w-xs text-zinc-300">
                      {proc.commandLine}
                    </td>
                    <td className="p-2.5 text-right font-bold text-amber-400">{proc.cpuPercent}%</td>
                    <td className="p-2.5 text-right text-zinc-400">{proc.memoryMb} MB</td>
                    <td className="p-2.5 text-center">
                      {proc.isSuspicious ? (
                        <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white animate-pulse">
                          {proc.threatClassification || "MALICIOUS"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-500">Normal</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleKillPid(proc.pid, proc.processName)}
                        className="rounded bg-rose-600/80 px-2 py-1 text-[10px] font-black uppercase text-white hover:bg-rose-700 transition-colors"
                      >
                        Kill (SIGKILL)
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-200 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800">
            <span>Showing {filteredProcesses.length} active OS processes.</span>
            <span>Kernel Telemetry Polling Rate: 1,000ms</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InstanceProcessManagerModal;
