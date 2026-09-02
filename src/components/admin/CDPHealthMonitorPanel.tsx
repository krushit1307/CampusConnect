// src/components/admin/CDPHealthMonitorPanel.tsx
// Issue: #5466 - Automated "Tax-Exempt" Crypto Capital Gains Calculator (DeFi Yield Donation Smart Routing via Flash Minting and Flashbot Protection)
// Description: Admin interface for CDP health monitoring and deleveraging management

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Activity,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Zap,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface CDPPosition {
  id: string;
  user_id: string;
  cdp_id: string;
  collateral_type: string;
  collateral_amount: number;
  collateral_value_usd: number;
  debt_amount_dai: number;
  debt_value_usd: number;
  collateralization_ratio: number;
  liquidation_ratio: number;
  safety_threshold: number;
  is_active: boolean;
  is_liquidated: boolean;
  is_deleveraging: boolean;
  use_flashbots: boolean;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
}

interface CDPHealthMonitor {
  id: string;
  cdp_position_id: string;
  current_collateralization_ratio: number;
  current_collateral_value_usd: number;
  current_debt_value_usd: number;
  current_eth_price_usd: number;
  health_status: string;
  alert_triggered: boolean;
  alert_type: string;
  deleveraging_triggered: boolean;
  deleveraging_amount_dai: number;
  deleveraging_timestamp: string;
  monitored_at: string;
}

interface FlashbotTransaction {
  id: string;
  user_id: string;
  cdp_position_id: string;
  transaction_type: string;
  transaction_hash: string;
  bundle_hash: string;
  flashbots_rpc_endpoint: string;
  block_number: number;
  gas_price_gwei: number;
  gas_used: number;
  transaction_cost_usd: number;
  mev_savings_usd: number;
  sandwich_attack_prevented: boolean;
  status: string;
  submitted_at: string;
  included_at: string;
  error_message: string;
}

interface OraclePrice {
  id: string;
  asset_symbol: string;
  price_usd: number;
  oracle_source: string;
  price_change_24h: number;
  volume_24h: number;
  recorded_at: string;
}

export function CDPHealthMonitorPanel() {
  const supabase = createClient();
  const [cdpPositions, setCDPPositions] = useState<CDPPosition[]>([]);
  const [healthMonitors, setHealthMonitors] = useState<CDPHealthMonitor[]>([]);
  const [flashbotTransactions, setFlashbotTransactions] = useState<FlashbotTransaction[]>([]);
  const [oraclePrices, setOraclePrices] = useState<OraclePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"positions" | "health" | "flashbots" | "oracle">(
    "positions",
  );

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "positions") {
        await fetchCDPPositions();
      } else if (activeTab === "health") {
        await fetchHealthMonitors();
      } else if (activeTab === "flashbots") {
        await fetchFlashbotTransactions();
      } else if (activeTab === "oracle") {
        await fetchOraclePrices();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const fetchCDPPositions = async () => {
    const { data, error } = await supabase
      .from("cdp_positions")
      .select(
        `
        *,
        profiles!inner(full_name, email)
      `,
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const formattedData = (data || []).map((item: any) => ({
      ...item,
      user_name: item.profiles?.full_name,
      user_email: item.profiles?.email,
    }));

    setCDPPositions(formattedData);
  };

  const fetchHealthMonitors = async () => {
    const { data, error } = await supabase
      .from("cdp_health_monitor")
      .select("*")
      .order("monitored_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    setHealthMonitors(data || []);
  };

  const fetchFlashbotTransactions = async () => {
    const { data, error } = await supabase
      .from("flashbot_transactions")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    setFlashbotTransactions(data || []);
  };

  const fetchOraclePrices = async () => {
    const { data, error } = await supabase
      .from("oracle_price_history")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    setOraclePrices(data || []);
  };

  const triggerHealthMonitor = async () => {
    try {
      const response = await fetch("/functions/v1/cdp-health-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "monitor" }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Health monitoring cycle completed");
        fetchData();
      } else {
        toast.error("Health monitoring failed");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to trigger health monitor");
    }
  };

  const triggerDeleveraging = async (cdpPositionId: string, amount: number) => {
    try {
      const response = await fetch("/functions/v1/cdp-health-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleverage",
          cdp_position_id: cdpPositionId,
          deleveraging_amount_dai: amount,
          use_flashbots: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Deleveraging triggered successfully");
        fetchData();
      } else {
        toast.error("Deleveraging failed");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to trigger deleveraging");
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      healthy: "bg-green-100 text-green-800",
      warning: "bg-yellow-100 text-yellow-800",
      critical: "bg-red-100 text-red-800",
      liquidated: "bg-black text-white",
      pending: "bg-blue-100 text-blue-800",
      submitted: "bg-purple-100 text-purple-800",
      included: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      reverted: "bg-orange-100 text-orange-800",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-bold ${colors[status] || colors.pending}`}
      >
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-32 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display uppercase">CDP Health Monitor</h2>
          <p className="text-sm text-gray-600 font-mono mt-1">
            Automated Collateralized Debt Position monitoring with Flashbots protection
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={triggerHealthMonitor} variant="outline">
            <Activity className="w-4 h-4 mr-2" />
            Run Health Check
          </Button>
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <Button
          variant={activeTab === "positions" ? "default" : "ghost"}
          onClick={() => setActiveTab("positions")}
        >
          <Shield className="w-4 h-4 mr-2" />
          CDP Positions
        </Button>
        <Button
          variant={activeTab === "health" ? "default" : "ghost"}
          onClick={() => setActiveTab("health")}
        >
          <Activity className="w-4 h-4 mr-2" />
          Health Monitor
        </Button>
        <Button
          variant={activeTab === "flashbots" ? "default" : "ghost"}
          onClick={() => setActiveTab("flashbots")}
        >
          <Zap className="w-4 h-4 mr-2" />
          Flashbots
        </Button>
        <Button
          variant={activeTab === "oracle" ? "default" : "ghost"}
          onClick={() => setActiveTab("oracle")}
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Oracle Prices
        </Button>
      </div>

      {activeTab === "positions" && (
        <div className="border-2 border-gray-200 bg-white rounded-lg p-4">
          <h3 className="font-bold font-display uppercase mb-4">CDP Positions</h3>
          {cdpPositions.length === 0 ? (
            <p className="text-gray-600 font-mono">No CDP positions</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {cdpPositions.map((position) => (
                <div
                  key={position.id}
                  className={`p-3 rounded border ${
                    position.collateralization_ratio < position.safety_threshold
                      ? "bg-red-50 border-red-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-500" />
                      <span className="font-bold">{position.cdp_id}</span>
                      {position.is_deleveraging && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-bold">
                          Deleveraging
                        </span>
                      )}
                      {position.use_flashbots && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold">
                          Flashbots
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(position.updated_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 font-mono space-y-1 mb-2">
                    <p>
                      User: {position.user_name} ({position.user_email})
                    </p>
                    <p>
                      Collateral: {position.collateral_amount.toFixed(4)} {position.collateral_type}{" "}
                      (${position.collateral_value_usd.toLocaleString()})
                    </p>
                    <p>
                      Debt: {position.debt_amount_dai.toFixed(2)} DAI ($
                      {position.debt_value_usd.toLocaleString()})
                    </p>
                    <p>Collateralization Ratio: {position.collateralization_ratio.toFixed(2)}x</p>
                    <p>Safety Threshold: {position.safety_threshold.toFixed(2)}x</p>
                    <p>Liquidation Ratio: {position.liquidation_ratio.toFixed(2)}x</p>
                  </div>
                  {position.collateralization_ratio < position.safety_threshold && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          triggerDeleveraging(position.id, position.debt_amount_dai * 0.1)
                        }
                      >
                        Trigger Deleveraging
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "health" && (
        <div className="border-2 border-gray-200 bg-white rounded-lg p-4">
          <h3 className="font-bold font-display uppercase mb-4">Health Monitor</h3>
          {healthMonitors.length === 0 ? (
            <p className="text-gray-600 font-mono">No health monitor records</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {healthMonitors.map((monitor) => (
                <div
                  key={monitor.id}
                  className={`p-3 rounded border ${
                    monitor.health_status === "critical"
                      ? "bg-red-50 border-red-200"
                      : monitor.health_status === "warning"
                        ? "bg-yellow-50 border-yellow-200"
                        : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-gray-500" />
                      <span className="font-bold">
                        CDP: {monitor.cdp_position_id.substring(0, 8)}...
                      </span>
                      {getStatusBadge(monitor.health_status)}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(monitor.monitored_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 font-mono space-y-1 mb-2">
                    <p>
                      Collateralization Ratio: {monitor.current_collateralization_ratio.toFixed(2)}x
                    </p>
                    <p>
                      Collateral Value: ${monitor.current_collateral_value_usd.toLocaleString()}
                    </p>
                    <p>Debt Value: ${monitor.current_debt_value_usd.toLocaleString()}</p>
                    <p>ETH Price: ${monitor.current_eth_price_usd.toLocaleString()}</p>
                    {monitor.alert_triggered && (
                      <p className="text-red-600">Alert: {monitor.alert_type}</p>
                    )}
                    {monitor.deleveraging_triggered && (
                      <p className="text-orange-600">
                        Deleveraging: {monitor.deleveraging_amount_dai.toFixed(2)} DAI
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "flashbots" && (
        <div className="border-2 border-gray-200 bg-white rounded-lg p-4">
          <h3 className="font-bold font-display uppercase mb-4">Flashbots Transactions</h3>
          {flashbotTransactions.length === 0 ? (
            <p className="text-gray-600 font-mono">No Flashbots transactions</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {flashbotTransactions.map((tx) => (
                <div key={tx.id} className="p-3 rounded border bg-purple-50 border-purple-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-purple-500" />
                      <span className="font-bold">{tx.transaction_type.toUpperCase()}</span>
                      {getStatusBadge(tx.status)}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(tx.submitted_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 font-mono space-y-1 mb-2">
                    {tx.transaction_hash && <p>TX: {tx.transaction_hash.substring(0, 10)}...</p>}
                    {tx.bundle_hash && <p>Bundle: {tx.bundle_hash.substring(0, 10)}...</p>}
                    {tx.block_number && <p>Block: {tx.block_number.toLocaleString()}</p>}
                    {tx.gas_price_gwei && <p>Gas Price: {tx.gas_price_gwei.toFixed(2)} gwei</p>}
                    {tx.gas_used && <p>Gas Used: {tx.gas_used.toLocaleString()}</p>}
                    {tx.transaction_cost_usd && <p>Cost: ${tx.transaction_cost_usd.toFixed(2)}</p>}
                    {tx.mev_savings_usd && (
                      <p className="text-green-600">
                        MEV Savings: ${tx.mev_savings_usd.toFixed(2)}
                      </p>
                    )}
                    {tx.sandwich_attack_prevented && (
                      <p className="text-purple-600">Sandwich Attack Prevented</p>
                    )}
                  </div>
                  {tx.error_message && (
                    <p className="text-sm text-red-700 mb-2">{tx.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "oracle" && (
        <div className="border-2 border-gray-200 bg-white rounded-lg p-4">
          <h3 className="font-bold font-display uppercase mb-4">Oracle Price History</h3>
          {oraclePrices.length === 0 ? (
            <p className="text-gray-600 font-mono">No oracle price records</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {oraclePrices.map((price) => (
                <div key={price.id} className="p-3 rounded border bg-green-50 border-green-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      <span className="font-bold">{price.asset_symbol}</span>
                      <span className="text-sm font-mono">${price.price_usd.toLocaleString()}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(price.recorded_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 font-mono space-y-1">
                    <p>Source: {price.oracle_source}</p>
                    {price.price_change_24h && (
                      <p
                        className={price.price_change_24h >= 0 ? "text-green-600" : "text-red-600"}
                      >
                        24h Change: {price.price_change_24h.toFixed(2)}%
                      </p>
                    )}
                    {price.volume_24h && <p>24h Volume: ${price.volume_24h.toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
