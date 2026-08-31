import React, { useState } from "react";
import {
  ShieldAlert,
  Lock,
  Unlock,
  Radio,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  Activity,
  ArrowLeft,
  Flame,
  Zap,
} from "lucide-react";
import { radarSecurityIncidentService } from "@/services/campusSafety/incident/radarSecurityIncidentService";
import { radarThreatWebhookService } from "@/services/campusSafety/radar/radarThreatWebhookService";
import { RadarSecurityIncident } from "@/types/radarSafety";
import { Link } from "react-router-dom";

export function RadarSecurityIncidentDashboard() {
  const [incidents, setIncidents] = useState<RadarSecurityIncident[]>(() =>
    radarSecurityIncidentService.getIncidents(),
  );
  const [selectedBuilding, setSelectedBuilding] = useState("Science Building");
  const [threatSeverity, setThreatSeverity] = useState<"WEAPON_DETECTED" | "HIGH_RISK">(
    "WEAPON_DETECTED",
  );
  const [simulateBlackout, setSimulateBlackout] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeIncident, setActiveIncident] = useState<RadarSecurityIncident | null>(null);

  const refreshIncidents = () => {
    setIncidents(radarSecurityIncidentService.getIncidents());
  };

  const handleSimulateRadarWebhook = async () => {
    setIsProcessing(true);
    const secretKey = "radar_demo_secret_key_99";
    const timestampHeader = Date.now().toString();

    const payloadObj = {
      eventId: `radar_evt_${Date.now()}`,
      provider: "evolv_radar",
      venueId: `v_${selectedBuilding.toLowerCase().replace(/\s+/g, "_")}`,
      building: selectedBuilding,
      checkpointId: "cp_main_entrance_turnstile",
      threatSeverity,
      confidenceScore: 0.98,
      detectedAtIso: new Date().toISOString(),
    };

    const payloadRaw = JSON.stringify(payloadObj);

    try {
      // 1. Verify Webhook HMAC Signature
      const signature = await radarThreatWebhookService["provider"].computeHmacSha256(
        `${timestampHeader}.${payloadRaw}`,
        secretKey,
      );

      const verification = await radarThreatWebhookService.handleWebhook(
        payloadRaw,
        signature,
        timestampHeader,
        secretKey,
      );

      if (verification.isValid && verification.event) {
        // 2. Process Incident & Trigger Access Control Lockdown
        const incident = await radarSecurityIncidentService.processRadarThreatEvent(
          verification.event,
          simulateBlackout,
        );
        setActiveIncident(incident);
        refreshIncidents();
      }
    } catch (err) {
      console.error("Radar webhook simulation failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResolveIncident = async (incidentId: string) => {
    setIsProcessing(true);
    try {
      const resolved = await radarSecurityIncidentService.resolveIncident(incidentId);
      if (activeIncident?.incidentId === incidentId) {
        setActiveIncident(resolved);
      }
      refreshIncidents();
    } catch (err) {
      console.error("Resolution failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <Link
              to="/admin/emergency-broadcast"
              className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Emergency Operations
            </Link>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <ShieldAlert className="w-8 h-8 text-rose-500" />
              Weapon Detection Radar & Emergency Access Control
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Real-Time Millimeter-Wave Radar Threat Webhook Ingestion & Automated Turnstile
              Lockdown
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-rose-950/80 text-rose-400 border border-rose-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold">
              <Flame className="w-3.5 h-3.5 animate-pulse" /> HIGH-SECURITY INTEGRATION
            </span>
          </div>
        </div>

        {/* Control Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Simulated Radar Webhook Ingestion Control */}
          <div className="lg:col-span-1 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-rose-400" /> Radar Ingestion Webhook Test
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  Target Building
                </label>
                <select
                  value={selectedBuilding}
                  onChange={(e) => setSelectedBuilding(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  <option value="Science Building">Science Building</option>
                  <option value="Student Union Center">Student Union Center</option>
                  <option value="Library Building">Library Building</option>
                  <option value="Engineering Complex">Engineering Complex</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  Threat Severity
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setThreatSeverity("WEAPON_DETECTED")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                      threatSeverity === "WEAPON_DETECTED"
                        ? "bg-rose-950 border-rose-500 text-rose-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    Weapon Detected
                  </button>
                  <button
                    onClick={() => setThreatSeverity("HIGH_RISK")}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                      threatSeverity === "HIGH_RISK"
                        ? "bg-amber-950 border-amber-500 text-amber-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    High Risk
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-200 block">LoRaWAN Off-Grid Fallback</span>
                  <span className="text-[10px] text-slate-500">Simulate severed fiber line</span>
                </div>
                <input
                  type="checkbox"
                  checked={simulateBlackout}
                  onChange={(e) => setSimulateBlackout(e.target.checked)}
                  className="w-4 h-4 accent-rose-500"
                />
              </div>

              <button
                onClick={handleSimulateRadarWebhook}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.3)] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Verifying HMAC & Locking...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" /> Simulate Radar Webhook Event
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Active Radar Incidents & Access Control Logs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Incident Details Box */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-400" /> Active Security Incident Audit Log
                </h3>
                {activeIncident && (
                  <span className="text-xs font-mono bg-rose-950 text-rose-400 border border-rose-800 px-2.5 py-1 rounded font-bold">
                    {activeIncident.status}
                  </span>
                )}
              </div>

              {/* Audit Log Output Box */}
              <div className="h-64 bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-y-auto space-y-1.5">
                {activeIncident ? (
                  activeIncident.auditLogs.map((log, idx) => (
                    <p
                      key={idx}
                      className={
                        log.includes("Lock confirmed") || log.includes("Success")
                          ? "text-emerald-400 font-bold"
                          : log.includes("LoRaWAN")
                            ? "text-amber-400 font-bold"
                            : log.includes("Requesting")
                              ? "text-cyan-400"
                              : "text-slate-300"
                      }
                    >
                      {log}
                    </p>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-600 text-center space-y-2 font-sans">
                    <ShieldAlert className="w-8 h-8 text-slate-700" />
                    <p>
                      No active incident selected. Simulate a radar threat webhook on the left to
                      trigger emergency access control door locking.
                    </p>
                  </div>
                )}
              </div>

              {/* Incident Resolution Button */}
              {activeIncident && activeIncident.status !== "RESOLVED" && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => handleResolveIncident(activeIncident.incidentId)}
                    disabled={isProcessing}
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  >
                    <Unlock className="w-4 h-4" /> Issue Security Clearance & Unlock Doors
                  </button>
                </div>
              )}
            </div>

            {/* Incidents History List */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" /> Incident Audit Log History
              </h3>

              <div className="space-y-2">
                {incidents.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    No historical radar security incidents recorded.
                  </p>
                ) : (
                  incidents.map((inc) => (
                    <div
                      key={inc.incidentId}
                      onClick={() => setActiveIncident(inc)}
                      className={`p-3 bg-slate-950 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-all ${
                        activeIncident?.incidentId === inc.incidentId
                          ? "border-rose-500 bg-rose-950/20"
                          : "border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div>
                        <span className="font-bold text-white mr-2">{inc.building}</span>
                        <span className="text-slate-400">({inc.checkpointId})</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            inc.accessControlMethod === "LORAWAN"
                              ? "bg-amber-950 text-amber-300 border-amber-800"
                              : "bg-emerald-950 text-emerald-300 border-emerald-800"
                          }`}
                        >
                          {inc.accessControlMethod || "REST"} LOCK
                        </span>

                        <span className="font-mono text-slate-500 text-[10px]">
                          {new Date(inc.detectedAtIso).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RadarSecurityIncidentDashboard;
