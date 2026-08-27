// =============================================================================
// Route: /admin/kiosk-fleet
// Issue: #3455 - Develop a 'Real-Time Hardware Metrics Dashboard' for Kiosks
// Description: Centralized Fleet Management Dashboard visualizing battery status,
// charging status, network ping latency, and online/offline states for deployed kiosk iPads.
// Flashes critical red warnings when battery drops below 15% while not charging.
// =============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  isDyingBattery,
  isDeviceOffline,
  type KioskTelemetryPayload,
} from "@/services/kioskTelemetry";
import Battery from "lucide-react/dist/esm/icons/battery";
import BatteryLow from "lucide-react/dist/esm/icons/battery-low";
import BatteryWarning from "lucide-react/dist/esm/icons/battery-warning";
import Zap from "lucide-react/dist/esm/icons/zap";
import Wifi from "lucide-react/dist/esm/icons/wifi";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Monitor from "lucide-react/dist/esm/icons/monitor";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import XCircle from "lucide-react/dist/esm/icons/x-circle";

export default function AdminKioskFleetDashboard() {
  const supabase = createClient();
  const [devices, setDevices] = useState<KioskTelemetryPayload[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Fetch initial telemetry state from Supabase
  const fetchFleetStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("kiosk_devices")
        .select("*")
        .order("last_seen", { ascending: false });

      if (error) throw error;
      setDevices((data || []) as KioskTelemetryPayload[]);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("[KioskFleet] Failed to load fleet status:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFleetStatus();

    // Subscribe to Supabase Realtime table changes for kiosk_devices
    const channel = supabase
      .channel("kiosk_devices_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kiosk_devices" },
        (payload) => {
          const updatedDevice = payload.new as KioskTelemetryPayload;
          if (updatedDevice && updatedDevice.device_id) {
            setDevices((prev) => {
              const existingIdx = prev.findIndex((d) => d.device_id === updatedDevice.device_id);
              if (existingIdx >= 0) {
                const updatedList = [...prev];
                updatedList[existingIdx] = updatedDevice;
                return updatedList;
              } else {
                return [updatedDevice, ...prev];
              }
            });
            setLastRefreshed(new Date());
          }
        },
      )
      .subscribe();

    // Periodic local ticker every 10s to update offline state timers
    const ticker = setInterval(() => {
      setLastRefreshed(new Date());
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(ticker);
    };
  }, [fetchFleetStatus]);

  const dyingDevices = devices.filter((d) => isDyingBattery(d.battery_level, d.is_charging));
  const offlineDevices = devices.filter((d) => isDeviceOffline(d.last_seen, lastRefreshed));
  const onlineCount = devices.length - offlineDevices.length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-10 font-sans">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <Monitor className="w-8 h-8 text-indigo-400" />
            <h1 className="text-3xl font-extrabold tracking-tight">Kiosk Fleet Management</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Real-time telemetry & hardware diagnostics for deployed Gala iPads & check-in kiosks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">
            Last update: {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            type="button"
            onClick={() => fetchFleetStatus()}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* CRITICAL DYING BATTERY ALERT BANNER */}
      {dyingDevices.length > 0 && (
        <div
          data-testid="critical-dying-battery-alert"
          className="max-w-7xl mx-auto mb-8 bg-red-600 border-4 border-red-400 rounded-2xl p-6 shadow-2xl animate-pulse text-white flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-black/40 rounded-full">
              <AlertTriangle className="w-10 h-10 text-yellow-300" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider">
                🚨 CRITICAL HARDWARE ALERT!
              </h2>
              <div className="mt-1 text-sm md:text-base font-bold">
                {dyingDevices.map((d) => (
                  <div key={d.device_id}>
                    <span className="underline font-black text-yellow-200">{d.device_id} iPad</span>{" "}
                    is dying! Battery at{" "}
                    <span className="text-yellow-300 font-extrabold">{d.battery_level}%</span> (Not
                    Charging). Deploy charger immediately!
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">
            Total Deployed Fleet
          </div>
          <div className="text-3xl font-bold mt-2 text-white">{devices.length}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">
            Online / Broadcasting
          </div>
          <div className="text-3xl font-bold mt-2 text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6" />
            {onlineCount}
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">
            Offline (&gt; 3 mins)
          </div>
          <div className="text-3xl font-bold mt-2 text-amber-400 flex items-center gap-2">
            <XCircle className="w-6 h-6" />
            {offlineDevices.length}
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">
            Critical Low Battery
          </div>
          <div className="text-3xl font-bold mt-2 text-red-500 flex items-center gap-2">
            <BatteryWarning className="w-6 h-6" />
            {dyingDevices.length}
          </div>
        </div>
      </div>

      {/* Devices Grid */}
      <div className="max-w-7xl mx-auto">
        <h2 className="text-xl font-bold mb-4 text-slate-200">Door Kiosk Device Status</h2>

        {devices.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center text-slate-400 font-mono">
            No kiosk telemetry received yet. Active kiosks will broadcast telemetry every 60
            seconds.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => {
              const isOffline = isDeviceOffline(device.last_seen, lastRefreshed);
              const isDying = isDyingBattery(device.battery_level, device.is_charging);

              return (
                <div
                  key={device.device_id}
                  data-testid={`kiosk-card-${device.device_id}`}
                  className={`border rounded-2xl p-6 transition-all duration-300 ${
                    isDying
                      ? "bg-red-950/70 border-red-500 shadow-lg shadow-red-950"
                      : isOffline
                        ? "bg-slate-800/60 border-slate-700 opacity-75"
                        : "bg-slate-800 border-slate-700 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        {device.device_id}
                      </h3>
                      {device.event_id && (
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          Event: {device.event_id.substring(0, 8)}...
                        </p>
                      )}
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                        isOffline
                          ? "bg-slate-700 text-slate-300"
                          : isDying
                            ? "bg-red-600 text-white animate-bounce"
                            : "bg-emerald-950 text-emerald-300 border border-emerald-700"
                      }`}
                    >
                      {isOffline ? (
                        <>
                          <XCircle className="w-3.5 h-3.5" /> Offline
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Online
                        </>
                      )}
                    </span>
                  </div>

                  {/* Battery Gauge */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1 font-semibold">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        {device.is_charging ? (
                          <Zap className="w-4 h-4 text-yellow-400 fill-current" />
                        ) : device.battery_level < 20 ? (
                          <BatteryLow className="w-4 h-4 text-red-400" />
                        ) : (
                          <Battery className="w-4 h-4 text-slate-300" />
                        )}
                        Battery: {device.battery_level}%
                      </span>
                      <span className="text-slate-400">
                        {device.is_charging ? "Charging" : "Discharging"}
                      </span>
                    </div>

                    <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-700">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          device.battery_level <= 15
                            ? "bg-red-500"
                            : device.battery_level <= 30
                              ? "bg-amber-400"
                              : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, device.battery_level))}%` }}
                      />
                    </div>
                  </div>

                  {/* Telemetry Metrics Footer */}
                  <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{device.ping_ms} ms</span>
                      {device.network_type && (
                        <span className="uppercase text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-300">
                          {device.network_type}
                        </span>
                      )}
                    </div>

                    <div className="font-mono text-[11px]">
                      {new Date(device.last_seen).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
