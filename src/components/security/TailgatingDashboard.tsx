import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  DoorOpen,
  Camera,
  Bell,
  Clock,
  Radio,
  FileText,
  Activity,
  CheckCircle,
  AlertTriangle,
  Lock,
  UserCheck,
} from "lucide-react";
import { tailgatingService } from "../../services/tailgatingService";
import { SecurityEvent, ProviderHealth, IncidentStatus } from "../../types/tailgating";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

export const TailgatingDashboard: React.FC = () => {
  const [incidents, setIncidents] = useState<SecurityEvent[]>([]);
  const [healths, setHealths] = useState<Record<string, ProviderHealth>>({});
  const [selectedIncident, setSelectedIncident] = useState<SecurityEvent | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>("");
  const [resolutionStatus, setResolutionStatus] = useState<IncidentStatus>("RESOLVED");
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"incidents" | "health" | "audit">("incidents");

  const loadData = async () => {
    setLoading(true);
    try {
      const inc = await tailgatingService.getSecurityIncidents();
      setIncidents(inc);
      setHealths(tailgatingService.getProviderHealths());
    } catch {
      toast.error("Failed to load security dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Simulate real-time updates polling every 5 seconds
    const interval = setInterval(async () => {
      const inc = await tailgatingService.getSecurityIncidents();
      setIncidents(inc);
      setHealths(tailgatingService.getProviderHealths());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (id: string) => {
    try {
      const success = await tailgatingService.acknowledgeIncident(id, "officer-web-01");
      if (success) {
        toast.success("Incident acknowledged.");
        loadData();
        setSelectedIncident(null);
      }
    } catch {
      toast.error("Acknowledgement failed.");
    }
  };

  const handleResolve = async (id: string) => {
    if (!resolutionNotes.trim()) {
      toast.error("Please add resolution notes before closing.");
      return;
    }
    try {
      const success = await tailgatingService.resolveIncident(
        id,
        resolutionStatus,
        "officer-web-01",
        resolutionNotes,
      );
      if (success) {
        toast.success(`Incident status updated to ${resolutionStatus}.`);
        setResolutionNotes("");
        setSelectedIncident(null);
        loadData();
      }
    } catch {
      toast.error("Resolution failed.");
    }
  };

  const getSeverityBadge = (sev: string) => {
    const classes = {
      CRITICAL: "bg-rose-100 text-rose-800 border-rose-400 dark:bg-rose-950/20 dark:text-rose-400",
      HIGH: "bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-950/20 dark:text-amber-400",
      MEDIUM: "bg-blue-100 text-blue-800 border-blue-400 dark:bg-blue-950/20 dark:text-blue-400",
      LOW: "bg-zinc-100 text-zinc-800 border-zinc-400 dark:bg-zinc-800/20 dark:text-zinc-400",
      INFO: "bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-950/20 dark:text-emerald-400",
    };
    return cn(
      "px-2 py-0.5 border text-[10px] font-black rounded uppercase tracking-wider",
      classes[sev as keyof typeof classes] || classes.INFO,
    );
  };

  const getStatusBadge = (status: IncidentStatus) => {
    const classes = {
      NEW: "bg-red-500 text-white border-red-700",
      ACKNOWLEDGED: "bg-amber-500 text-black border-amber-700",
      INVESTIGATING: "bg-blue-500 text-white border-blue-700",
      RESOLVED: "bg-emerald-500 text-white border-emerald-700",
      FALSE_POSITIVE: "bg-zinc-500 text-white border-zinc-700",
    };
    return cn(
      "px-2.5 py-0.5 border-2 text-[9px] font-black uppercase rounded shadow-[1px_1px_0px_rgba(0,0,0,1)]",
      classes[status],
    );
  };

  const getHealthIcon = (state: ProviderHealth) => {
    if (state === "HEALTHY") return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    if (state === "DEGRADED") return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    return <AlertTriangle className="h-5 w-5 text-rose-500 animate-pulse" />;
  };

  return (
    <div className="container mx-auto px-4 py-8 font-mono text-zinc-900 dark:text-zinc-100 max-w-7xl">
      {/* Dashboard Header */}
      <div className="neu-border bg-white dark:bg-zinc-900 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight flex items-center gap-2">
              <ShieldAlert className="h-7 w-7 text-rose-600" />
              Tailgating & Perimeter Security Center
            </h1>
            <p className="text-xs text-zinc-500 mt-1.5">
              Defensive access monitoring tracking threshold crossings against expected authorized
              badge counts.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("incidents")}
              className={cn(
                "px-4 py-2 border-2 border-black font-bold text-xs uppercase transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                activeTab === "incidents"
                  ? "bg-zinc-100 shadow-none translate-x-[2px] translate-y-[2px]"
                  : "bg-white dark:bg-zinc-800",
              )}
            >
              <Radio className="h-4 w-4 inline mr-1.5" />
              Alert Log
            </button>
            <button
              onClick={() => setActiveTab("health")}
              className={cn(
                "px-4 py-2 border-2 border-black font-bold text-xs uppercase transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                activeTab === "health"
                  ? "bg-zinc-100 shadow-none translate-x-[2px] translate-y-[2px]"
                  : "bg-white dark:bg-zinc-800",
              )}
            >
              <Activity className="h-4 w-4 inline mr-1.5" />
              Sensor Health
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={cn(
                "px-4 py-2 border-2 border-black font-bold text-xs uppercase transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                activeTab === "audit"
                  ? "bg-zinc-100 shadow-none translate-x-[2px] translate-y-[2px]"
                  : "bg-white dark:bg-zinc-800",
              )}
            >
              <FileText className="h-4 w-4 inline mr-1.5" />
              Audit Log
            </button>
          </div>
        </div>
      </div>

      {activeTab === "incidents" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Incidents List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold uppercase text-zinc-500 mb-2">
              Active Security Incidents
            </h2>

            {loading ? (
              <div className="neu-border p-8 bg-white dark:bg-zinc-900 text-center text-sm">
                Scanning perimeter sensors...
              </div>
            ) : incidents.length === 0 ? (
              <div className="neu-border border-dashed p-12 bg-white dark:bg-zinc-900 text-center text-sm">
                <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                Perimeter secure. No tailgating incidents observed.
              </div>
            ) : (
              incidents.map((incident) => (
                <div
                  key={incident.id}
                  onClick={() => setSelectedIncident(incident)}
                  className={cn(
                    "neu-border p-5 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none cursor-pointer transition-all border-l-8",
                    incident.status === "NEW" ? "border-l-rose-500" : "border-l-zinc-300",
                  )}
                >
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div>
                      <span className={getSeverityBadge(incident.severity)}>
                        {incident.severity}
                      </span>
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mt-2 flex items-center gap-1.5">
                        <DoorOpen className="h-4 w-4 text-zinc-500" />
                        Door ID: {incident.doorId.substring(0, 8)}...
                      </h3>
                      <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(incident.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {getStatusBadge(incident.status)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded text-xs border border-zinc-200 dark:border-zinc-700">
                    <div>
                      <span className="text-[10px] text-zinc-400 block uppercase">Expected</span>
                      <span className="font-black text-sm">{incident.expectedCount} person</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block uppercase">Observed</span>
                      <span className="font-black text-rose-500 text-sm">
                        {incident.observedCount} people
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block uppercase">Confidence</span>
                      <span className="font-black text-sm">
                        {(incident.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Incident Detail / Action Panel */}
          <div>
            <h2 className="text-sm font-bold uppercase text-zinc-500 mb-2">Details & Response</h2>
            {selectedIncident ? (
              <div className="neu-border p-6 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] space-y-6">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <h3 className="font-bold text-sm">
                    Incident {selectedIncident.id.substring(0, 8)}
                  </h3>
                  <span className={getSeverityBadge(selectedIncident.severity)}>
                    {selectedIncident.severity}
                  </span>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-bold uppercase">Location/Door:</span>
                    <span className="font-black">{selectedIncident.doorId.substring(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-bold uppercase">Associated Camera:</span>
                    <span className="font-black">{selectedIncident.cameraId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 font-bold uppercase">Badge Correlation:</span>
                    <span className="font-black truncate max-w-[150px]">
                      {selectedIncident.correlationId}
                    </span>
                  </div>
                </div>

                {selectedIncident.status === "NEW" && (
                  <button
                    onClick={() => handleAcknowledge(selectedIncident.id)}
                    className="w-full py-2.5 bg-amber-400 hover:bg-amber-500 border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Lock className="h-4 w-4" /> Acknowledge Threat
                  </button>
                )}

                {selectedIncident.status !== "RESOLVED" &&
                  selectedIncident.status !== "FALSE_POSITIVE" && (
                    <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-4">
                      <h4 className="text-xs font-black uppercase text-zinc-400">Close Incident</h4>
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-500 block uppercase">
                          Resolution Verdict:
                        </label>
                        <select
                          value={resolutionStatus}
                          onChange={(e) => setResolutionStatus(e.target.value as IncidentStatus)}
                          className="w-full border-2 border-black p-2 bg-white dark:bg-zinc-800 text-xs font-bold"
                        >
                          <option value="RESOLVED">Perimeter Secured (Resolved)</option>
                          <option value="FALSE_POSITIVE">False Positive / Filter Bug</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-500 block uppercase">
                          Incident Notes:
                        </label>
                        <textarea
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="Provide details about the response..."
                          className="w-full border-2 border-black p-2 text-xs h-20 outline-none resize-none bg-white dark:bg-zinc-800 font-bold"
                        />
                      </div>

                      <button
                        onClick={() => handleResolve(selectedIncident.id)}
                        className="w-full py-2.5 bg-black text-white hover:bg-zinc-800 border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all"
                      >
                        Submit Close Report
                      </button>
                    </div>
                  )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-800 p-6 text-center text-xs text-zinc-400 rounded-lg">
                Select an incident from the alert log to view metadata evidence and perform locks or
                overrides.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "health" && (
        <div className="neu-border p-6 bg-white dark:bg-zinc-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
          <h2 className="text-sm font-bold uppercase text-zinc-500 mb-6">
            Security Node Diagnostics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border-2 border-black p-4 flex justify-between items-center rounded-lg">
              <div>
                <span className="font-bold text-xs uppercase block text-zinc-400">
                  Badge Reader Network
                </span>
                <span className="font-black text-sm text-zinc-700 dark:text-zinc-300">
                  {healths.access_control || "HEALTHY"}
                </span>
              </div>
              {getHealthIcon(healths.access_control || "HEALTHY")}
            </div>
            <div className="border-2 border-black p-4 flex justify-between items-center rounded-lg">
              <div>
                <span className="font-bold text-xs uppercase block text-zinc-400">
                  People Counters
                </span>
                <span className="font-black text-sm text-zinc-700 dark:text-zinc-300">
                  {healths.camera_counting || "HEALTHY"}
                </span>
              </div>
              {getHealthIcon(healths.camera_counting || "HEALTHY")}
            </div>
            <div className="border-2 border-black p-4 flex justify-between items-center rounded-lg">
              <div>
                <span className="font-bold text-xs uppercase block text-zinc-400">
                  Siren & Locks Dispatch
                </span>
                <span className="font-black text-sm text-zinc-700 dark:text-zinc-300">
                  {healths.alarms || "HEALTHY"}
                </span>
              </div>
              {getHealthIcon(healths.alarms || "HEALTHY")}
            </div>
            <div className="border-2 border-black p-4 flex justify-between items-center rounded-lg">
              <div>
                <span className="font-bold text-xs uppercase block text-zinc-400">
                  Notifications Relay
                </span>
                <span className="font-black text-sm text-zinc-700 dark:text-zinc-300">
                  {healths.notifications || "HEALTHY"}
                </span>
              </div>
              {getHealthIcon(healths.notifications || "HEALTHY")}
            </div>
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="neu-border p-6 bg-white dark:bg-zinc-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
          <h2 className="text-sm font-bold uppercase text-zinc-500 mb-4">
            Security Administration Audit Trail
          </h2>
          <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-2">
            {tailgatingService.getAuditLogs().length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">
                No administrative security actions recorded.
              </p>
            ) : (
              tailgatingService.getAuditLogs().map((log) => (
                <div
                  key={log.id}
                  className="border border-zinc-200 dark:border-zinc-800 p-3 rounded text-xs flex justify-between gap-4"
                >
                  <div>
                    <span className="px-1.5 py-0.5 border border-black bg-zinc-100 text-zinc-800 rounded font-black text-[9px] uppercase mr-2">
                      {log.action}
                    </span>
                    <span className="text-zinc-600 dark:text-zinc-400 font-bold">
                      {log.details}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400 text-right">
                    <span>{log.userId}</span>
                    <span className="block">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
