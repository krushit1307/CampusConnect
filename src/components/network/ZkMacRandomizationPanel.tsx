import React, { useState } from "react";
import { Shield, RefreshCw, CheckCircle2, Lock, Wifi, AlertTriangle } from "lucide-react";
import {
  generateRandomLocallyAdministeredMac,
  createAnonymousMacSession,
  generateZkRoamingProof,
  rotateAnonymousMacSession,
} from "@/lib/network/zkFederatedMacManager";
import { AnonymousMacSessionResponse } from "@/types/zkFederatedMac";

interface ZkMacRandomizationPanelProps {
  homeCampusId?: string;
  defaultHostCampusId?: string;
}

export const ZkMacRandomizationPanel: React.FC<ZkMacRandomizationPanelProps> = ({
  homeCampusId = "harvard.edu",
  defaultHostCampusId = "mit.edu",
}) => {
  const [hostCampus, setHostCampus] = useState(defaultHostCampusId);
  const [currentMac, setCurrentMac] = useState(generateRandomLocallyAdministeredMac());
  const [activeSession, setActiveSession] = useState<AnonymousMacSessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rotationHistory, setRotationHistory] = useState<string[]>([]);

  const handleConnectAnonymousRoaming = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // 1. Generate ZK Identity Proof without revealing name/ID
      const mockCredential = {
        credentialId: `cred-${Date.now()}`,
        homeCampusId,
        userCommitmentHash: `commit-${Math.random().toString(36).substring(2)}`,
        signature: `sig-${Math.random().toString(36).substring(2)}`,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        issuedAt: new Date().toISOString(),
      };

      const proofPayload = await generateZkRoamingProof(
        mockCredential,
        hostCampus,
        "user-secret-salt",
      );

      // 2. Present proof to host campus RADIUS auth server
      const session = await createAnonymousMacSession({
        hostCampusId: hostCampus,
        randomizedMacAddress: currentMac,
        proofPayload,
        requestedDurationMinutes: 120,
      });

      setActiveSession(session);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to establish anonymous roaming session.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRotateMac = async () => {
    if (!activeSession) return;
    setIsLoading(true);
    setErrorMsg(null);

    const newMac = generateRandomLocallyAdministeredMac();
    try {
      const updatedSession = await rotateAnonymousMacSession({
        sessionId: activeSession.sessionId,
        currentMacAddress: currentMac,
        newMacAddress: newMac,
        rotationProof: {
          nullifierHash: activeSession.nullifierHash,
          sessionSignature: "sig-rotate",
        },
      });

      setRotationHistory((prev) => [currentMac, ...prev]);
      setCurrentMac(newMac);
      setActiveSession(updatedSession);
    } catch (err: any) {
      setErrorMsg(err.message || "MAC rotation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-xl max-w-2xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Zero-Knowledge Identity Federation
              <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                Active Privacy
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Eduroam Dynamic MAC Randomization & Anonymous Roaming (#5143)
            </p>
          </div>
        </div>
        <Lock className="w-5 h-5 text-indigo-400" />
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center text-rose-300 text-xs gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
          <label className="text-xs text-slate-400 font-medium block mb-1">
            Home University (Issuer)
          </label>
          <div className="text-sm font-semibold text-slate-200">{homeCampusId}</div>
          <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Identity Blinded via ZK Proof
          </div>
        </div>

        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
          <label className="text-xs text-slate-400 font-medium block mb-1">
            Host University (Network Roaming)
          </label>
          <select
            value={hostCampus}
            onChange={(e) => setHostCampus(e.target.value)}
            disabled={!!activeSession}
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
          >
            <option value="mit.edu">MIT (Massachusetts Institute of Technology)</option>
            <option value="stanford.edu">Stanford University</option>
            <option value="berkeley.edu">UC Berkeley</option>
            <option value="columbia.edu">Columbia University</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium">Dynamic Hardware MAC Address</span>
          <span className="text-[10px] text-indigo-400 font-mono">Locally Administered</span>
        </div>
        <div className="flex items-center justify-between">
          <code className="text-base font-mono font-bold text-indigo-300 tracking-wider">
            {currentMac}
          </code>
          {activeSession && (
            <button
              onClick={handleRotateMac}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Rotate MAC
            </button>
          )}
        </div>
      </div>

      {activeSession ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-2">
            <Wifi className="w-4 h-4" /> Anonymous Roaming Session Granted
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
            <div>
              <span className="text-slate-500">Session ID: </span>
              <span className="font-mono">{activeSession.sessionId.substring(0, 18)}...</span>
            </div>
            <div>
              <span className="text-slate-500">Isolated VLAN: </span>
              <span className="font-mono text-indigo-300">
                VLAN #{activeSession.anonymousVlanId}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Nullifier Hash: </span>
              <span className="font-mono text-emerald-300">
                {activeSession.nullifierHash.substring(0, 16)}...
              </span>
            </div>
            <div>
              <span className="text-slate-500">Expires At: </span>
              <span>{new Date(activeSession.expiresAt).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={handleConnectAnonymousRoaming}
          disabled={isLoading}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Shield className="w-4 h-4" />
          {isLoading
            ? "Generating Zero-Knowledge Proof..."
            : `Authenticate Anonymously on ${hostCampus}`}
        </button>
      )}

      {rotationHistory.length > 0 && (
        <div className="mt-6 border-t border-slate-800 pt-4">
          <span className="text-xs text-slate-500 block mb-2 font-medium">
            Rotated MAC History (Isolated Telemetry)
          </span>
          <div className="flex flex-wrap gap-2">
            {rotationHistory.map((mac, idx) => (
              <span
                key={idx}
                className="text-[11px] font-mono px-2 py-1 bg-slate-800 text-slate-400 rounded"
              >
                {mac}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
