import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { createClient } from "@/lib/supabase/client";
import Umbrella from "lucide-react/dist/esm/icons/umbrella";
import Activity from "lucide-react/dist/esm/icons/activity";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";

const INSURANCE_ABI = [
  "function purchasePolicy(string memory eventId, uint256 coverageAmount, int256 lat, int256 lon) external payable",
  "function reportPrecipitation(string memory eventId, uint256 precipitationInches) external",
  "function rainReports(string memory, address) external view returns (uint256 precipitationInches, bool hasReported)",
];

const CONTRACT_ADDRESS = "0xCf742353EE374ea1800a5b35c243b11e5454b1cd"; // Localhost deployment default address
const NOAA_ORACLE = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const ACCUWEATHER_ORACLE = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const IOT_ORACLE = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

interface ParametricInsuranceWidgetProps {
  eventId: string;
}

interface PolicyRecord {
  id: string;
  premium_amount: number;
  coverage_amount: number;
  status: "active" | "claimed" | "expired";
}

interface OracleReportRecord {
  id: string;
  oracle_source: "NOAA" | "AccuWeather" | "IoT_Rain_Gauge";
  precipitation_inches: number;
  created_at: string;
}

export function ParametricInsuranceWidget({ eventId }: ParametricInsuranceWidgetProps) {
  const [account, setAccount] = useState<string | null>(null);
  const [premium, setPremium] = useState("250");
  const [coverage, setCoverage] = useState("5000");
  const [policy, setPolicy] = useState<PolicyRecord | null>(null);
  const [reports, setReports] = useState<OracleReportRecord[]>([]);
  const [selectedOracle, setSelectedOracle] = useState<"NOAA" | "AccuWeather" | "IoT_Rain_Gauge">(
    "NOAA",
  );
  const [precipVal, setPrecipVal] = useState("1.2");
  const [isLoading, setIsLoading] = useState(false);

  const fetchPolicyData = async () => {
    const supabase = createClient();
    const { data: policiesData } = await supabase
      .from("parametric_policies")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    if (policiesData) {
      setPolicy(policiesData);
      const { data: reportsData } = await supabase
        .from("oracle_weather_reports")
        .select("*")
        .eq("policy_id", policiesData.id);
      if (reportsData) setReports(reportsData);
    }
  };

  useEffect(() => {
    fetchPolicyData();
  }, [eventId]);

  const connectWallet = async () => {
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);
    } else {
      alert("Please install MetaMask!");
    }
  };

  const handlePurchasePolicy = async () => {
    if (!account) return alert("Please connect wallet first!");
    setIsLoading(true);

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, INSURANCE_ABI, signer);

      const parsedPremium = ethers.utils.parseEther((Number(premium) / 3000).toFixed(4)); // Simulated Eth pricing
      const parsedCoverage = ethers.utils.parseEther((Number(coverage) / 3000).toFixed(4));

      const tx = await contract.purchasePolicy(
        eventId,
        parsedCoverage,
        423600, // Latitude
        -710600, // Longitude
        { value: parsedPremium },
      );
      await tx.wait();

      const supabase = createClient();
      const { data } = await supabase
        .from("parametric_policies")
        .insert({
          event_id: eventId,
          premium_amount: Number(premium),
          coverage_amount: Number(coverage),
          status: "active",
        })
        .select()
        .single();

      alert("Parametric Insurance policy purchased successfully!");
      if (data) setPolicy(data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to purchase policy.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReportPrecipitation = async () => {
    if (!account) return alert("Please connect wallet first!");
    if (!policy) return alert("No active policy found.");
    setIsLoading(true);

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, INSURANCE_ABI, signer);

      // fixed-point: 1.2 inches => 120
      const fixedPrecip = Math.round(Number(precipVal) * 100);

      const tx = await contract.reportPrecipitation(eventId, fixedPrecip);
      await tx.wait();

      const supabase = createClient();
      await supabase.from("oracle_weather_reports").insert({
        policy_id: policy.id,
        oracle_source: selectedOracle,
        precipitation_inches: Number(precipVal),
      });

      // Recalculate status in database if 2 oracles reported > 1.0 inches
      const currentReports = [
        ...reports,
        { oracle_source: selectedOracle, precipitation_inches: Number(precipVal) },
      ];
      const matches = currentReports.filter((r) => r.precipitation_inches > 1.0);

      if (matches.length >= 2) {
        await supabase
          .from("parametric_policies")
          .update({ status: "claimed" })
          .eq("id", policy.id);
        alert("Consensus reached! Payout released to club.");
      } else {
        alert("Precipitation report logged. Consensus check complete.");
      }

      fetchPolicyData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Oracle submission failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="parametric-insurance-widget"
      className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000] font-mono text-xs my-6 space-y-6"
    >
      <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-2 border-b-4 border-black pb-3">
        <Umbrella className="text-blue-600 animate-bounce" size={18} />
        Decentralized Parametric Insurance (2-of-3 Consensus)
      </h3>

      {!policy ? (
        <div className="space-y-4">
          <h4 className="font-bold uppercase">Configure Event Weather Coverage</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label>Coverage Amount (USD)</label>
              <input
                type="number"
                value={coverage}
                onChange={(e) => setCoverage(e.target.value)}
                className="border-2 border-black px-2 py-1.5"
                data-testid="coverage-input"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label>Premium Cost (USD)</label>
              <input
                type="number"
                value={premium}
                disabled
                className="border-2 border-black bg-slate-50 px-2 py-1.5"
              />
            </div>
          </div>
          {!account ? (
            <button
              onClick={connectWallet}
              data-testid="connect-insurance-wallet-btn"
              className="border-2 border-black bg-yellow-300 px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000]"
            >
              🦊 Connect MetaMask
            </button>
          ) : (
            <button
              onClick={handlePurchasePolicy}
              disabled={isLoading}
              data-testid="purchase-policy-btn"
              className="border-2 border-black bg-[#a3e635] px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000]"
            >
              {isLoading ? "Purchasing..." : "Purchase Policy"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Policy Active Details */}
          <div className="bg-blue-50 border-2 border-black p-4 space-y-2">
            <div className="font-black text-blue-800 uppercase text-[10px]">
              🛡️ Active Weather Coverage Policy
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-blue-700 font-bold">
              <div>Coverage: ${policy.coverage_amount}</div>
              <div>Premium: ${policy.premium_amount}</div>
              <div className="uppercase">Status: {policy.status}</div>
            </div>
          </div>

          {/* Oracles Consensus list */}
          <div className="space-y-3">
            <h4 className="font-bold uppercase flex items-center gap-1.5">
              <Activity size={16} /> Multi-Oracle Consensus Status
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {["NOAA", "AccuWeather", "IoT_Rain_Gauge"].map((source) => {
                const report = reports.find((r) => r.oracle_source === source);
                return (
                  <div
                    key={source}
                    className="border-2 border-black p-3 bg-slate-50 flex flex-col justify-between"
                  >
                    <span className="font-bold text-[10px] uppercase text-zinc-500">
                      {source.replace("_", " ")}
                    </span>
                    <span className="text-sm font-black mt-1.5">
                      {report ? `${report.precipitation_inches} in` : "Pending ⏳"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Simulation Tools */}
          <div className="border-t-2 border-black pt-4 space-y-3">
            <h4 className="font-bold uppercase">Simulate Consensus Oracle Submissions</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label>Consensus Source</label>
                <select
                  value={selectedOracle}
                  onChange={(e: any) => setSelectedOracle(e.target.value)}
                  className="border-2 border-black px-2 py-1.5"
                >
                  <option value="NOAA">NOAA (National Oceanic & Atmospheric)</option>
                  <option value="AccuWeather">AccuWeather Global API</option>
                  <option value="IoT_Rain_Gauge">Roof-mounted IoT Rain Gauge</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label>Observed Precipitation (inches)</label>
                <input
                  type="number"
                  value={precipVal}
                  onChange={(e) => setPrecipVal(e.target.value)}
                  className="border-2 border-black px-2 py-1.5"
                  step="0.1"
                  data-testid="precip-input"
                />
              </div>
            </div>
            <button
              onClick={handleReportPrecipitation}
              disabled={isLoading}
              data-testid="submit-oracle-btn"
              className="border-2 border-black bg-yellow-300 px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000]"
            >
              {isLoading ? "Submitting..." : "Submit Oracle Report"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
