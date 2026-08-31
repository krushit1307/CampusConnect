import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import UserCheck from "lucide-react/dist/esm/icons/user-check";
import Download from "lucide-react/dist/esm/icons/download";

interface OfacAlertRecord {
  id: string;
  vendor_name: string;
  owner_name: string;
  matched_entity: string;
  similarity_score: number;
  created_at: string;
}

export function OfacCompliancePanel() {
  const [alerts, setAlerts] = useState<OfacAlertRecord[]>([]);
  const [searchName, setSearchName] = useState("");
  const [searchOwner, setSearchOwner] = useState("");
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAlerts = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("ofac_alerts")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setAlerts(data);
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleManualScan = async () => {
    if (!searchName && !searchOwner) return alert("Please enter at least one name to scan.");
    setIsLoading(true);
    setScanResult(null);

    try {
      const supabase = createClient();

      // Perform local SQL string similarity lookup via RPC (simulates the Treasury API call)
      const { data, error } = await supabase
        .from("ofac_sdn_list")
        .select("entity_name, entity_type");

      if (error) throw error;

      let highestSim = 0;
      let matchedEntity = "";

      // Quick simple calculation of similarity (local fallback check)
      const checkStringSim = (str1: string, str2: string) => {
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        let intersection = 0;
        const chars = new Set([...s1]);
        chars.forEach((c) => {
          if (s2.includes(c)) intersection++;
        });
        const union = new Set([...s1, ...s2]).size;
        return union > 0 ? intersection / union : 0;
      };

      data.forEach((sdn) => {
        if (searchName) {
          const sim = checkStringSim(searchName, sdn.entity_name);
          if (sim > highestSim) {
            highestSim = sim;
            matchedEntity = sdn.entity_name;
          }
        }
        if (searchOwner) {
          const sim = checkStringSim(searchOwner, sdn.entity_name);
          if (sim > highestSim) {
            highestSim = sim;
            matchedEntity = sdn.entity_name;
          }
        }
      });

      const matchPercent = Math.round(highestSim * 100);

      if (matchPercent >= 95) {
        setScanResult(
          `❌ MATCH DETECTED! Found ${matchedEntity} on OFAC SDN list with a ${matchPercent}% similarity. Freeze required.`,
        );
      } else {
        setScanResult(
          `✅ SCAN PASSED: No sanctions matches found (highest similarity: ${matchPercent}%).`,
        );
      }
    } catch (err: any) {
      setScanResult("Scan failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="ofac-compliance-panel"
      className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000] font-mono text-xs my-6 space-y-6"
    >
      <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-2 border-b-4 border-black pb-3">
        <ShieldAlert className="text-red-600 animate-pulse" size={18} />
        Federal AML & OFAC Sanctions Compliance Center
      </h3>

      {/* Manual lookup tools */}
      <div className="space-y-4">
        <h4 className="font-bold uppercase">Manual Vendor Sanctions Scan</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label>Vendor Name</label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="border-2 border-black px-2 py-1.5"
              placeholder="e.g. Al-Qaeda Front Corp"
              data-testid="ofac-vendor-input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label>Owner/CEO Name</label>
            <input
              type="text"
              value={searchOwner}
              onChange={(e) => setSearchOwner(e.target.value)}
              className="border-2 border-black px-2 py-1.5"
              placeholder="e.g. Terry Terrorism"
              data-testid="ofac-owner-input"
            />
          </div>
        </div>
        <button
          onClick={handleManualScan}
          disabled={isLoading}
          data-testid="run-ofac-scan-btn"
          className="border-2 border-black bg-yellow-300 px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000]"
        >
          {isLoading ? "Scanning SDN List..." : "Run Sanctions Scan"}
        </button>

        {scanResult && (
          <div
            data-testid="ofac-scan-result"
            className={`p-3 border-2 border-black font-bold mt-3 ${
              scanResult.includes("MATCH")
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {scanResult}
          </div>
        )}
      </div>

      {/* Log of alerts */}
      <div className="border-t-4 border-black pt-4">
        <h4 className="font-bold uppercase mb-3 text-red-600">Active OFAC SDN Match Alerts</h4>
        {alerts.length === 0 ? (
          <div className="bg-slate-50 border-2 border-black p-4 text-center text-gray-500">
            No sanctions match alerts recorded.
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((record) => (
              <div
                key={record.id}
                data-testid={`ofac-alert-record-${record.id}`}
                className="border-2 border-black p-4 bg-red-50 border-l-8 border-l-red-600 space-y-2"
              >
                <div className="flex justify-between items-center">
                  <span className="font-black text-red-700">🚨 HIGH PRIORITY WARNING</span>
                  <span className="text-[10px] text-gray-500">
                    {new Date(record.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  <div>
                    Vendor: <strong>{record.vendor_name}</strong>
                  </div>
                  <div>
                    Owner: <strong>{record.owner_name}</strong>
                  </div>
                  <div>
                    Matched SDN Entity: <strong>{record.matched_entity}</strong>
                  </div>
                  <div>
                    Match Confidence:{" "}
                    <strong className="text-red-600">
                      {Math.round(record.similarity_score * 100)}%
                    </strong>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button className="border-2 border-black bg-white px-2.5 py-1 font-bold text-[10px] hover:bg-slate-100 flex items-center gap-1">
                    <Download size={12} /> Gen SARS Report
                  </button>
                  <button className="border-2 border-black bg-white px-2.5 py-1 font-bold text-[10px] hover:bg-slate-100 flex items-center gap-1">
                    <UserCheck size={12} /> Acknowledge Alert
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
