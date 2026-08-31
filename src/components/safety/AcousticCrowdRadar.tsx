import React, { useState, useEffect } from "react";
import { Radio, WifiOff, AlertTriangle, Activity, ShieldAlert, Volume2, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AcousticTelemetry {
  timestamp: string;
  db_level: number;
  estimated_crowd: number;
  wifi_device_count: number;
  hazard_status: "SAFE" | "WARNING" | "CRITICAL_CRUSH_HAZARD";
}

export const AcousticCrowdRadar: React.FC = () => {
  const [telemetry, setTelemetry] = useState<AcousticTelemetry>({
    timestamp: new Date().toISOString(),
    db_level: 45.2,
    estimated_crowd: 12,
    wifi_device_count: 10,
    hazard_status: "SAFE",
  });

  const [isSimulatingRave, setIsSimulatingRave] = useState(false);
  const roomCapacity = 100;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSimulatingRave) {
      // Simulate students turning off Wi-Fi and packing into the room
      let currentCrowd = 12;
      let currentWifi = 10;
      let currentDb = 45.2;

      interval = setInterval(() => {
        currentCrowd = Math.min(550, currentCrowd + Math.floor(Math.random() * 50) + 20);
        currentWifi = Math.max(0, currentWifi - Math.floor(Math.random() * 3) - 1); // Devices drop off network
        currentDb = Math.min(110, currentDb + Math.random() * 5 + 2); // Noise goes up

        let status: "SAFE" | "WARNING" | "CRITICAL_CRUSH_HAZARD" = "SAFE";
        if (currentCrowd > roomCapacity * 1.5) status = "CRITICAL_CRUSH_HAZARD";
        else if (currentCrowd > roomCapacity * 1.2) status = "WARNING";

        setTelemetry({
          timestamp: new Date().toISOString(),
          db_level: currentDb,
          estimated_crowd: currentCrowd,
          wifi_device_count: currentWifi,
          hazard_status: status,
        });
      }, 1500);
    } else {
      // Reset to baseline
      setTelemetry({
        timestamp: new Date().toISOString(),
        db_level: 45.2,
        estimated_crowd: 12,
        wifi_device_count: 10,
        hazard_status: "SAFE",
      });
    }
    return () => clearInterval(interval);
  }, [isSimulatingRave]);

  const toggleSimulation = () => {
    setIsSimulatingRave(!isSimulatingRave);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-8">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
            <Radio className="h-10 w-10 text-amber-500" />
            Acoustic DSP Overcrowding Radar
          </h1>
          <p className="text-slate-400 mt-3 font-mono text-base max-w-4xl leading-relaxed">
            Network telemetry fails when users intentionally disable their Wi-Fi (Airplane Mode).
            This system uses physical directional microphone arrays and FFT Digital Signal
            Processing to mathematically extract the "Pink Noise" signature of overlapping human
            vocal frequencies, calculating raw crowd mass completely independent of the digital
            network.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Column: Telemetry Matrix */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden h-full">
            <div
              className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-colors duration-1000 ${telemetry.hazard_status === "CRITICAL_CRUSH_HAZARD" ? "bg-red-500/20 animate-pulse" : "bg-amber-500/5"}`}
            ></div>
            <CardHeader className="border-b border-slate-800 pb-5">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-amber-400" />
                Live Sensor Feed: Basement 001
              </CardTitle>
              <CardDescription className="text-slate-400">
                Max Legal Fire Capacity: {roomCapacity} Persons
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Wi-Fi Deception Metric */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg flex items-center justify-between shadow-inner">
                <div className="flex items-center gap-3">
                  <WifiOff
                    className={`h-8 w-8 ${telemetry.wifi_device_count === 0 ? "text-red-500 animate-pulse" : "text-slate-500"}`}
                  />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      Wi-Fi Network Triangulation
                    </p>
                    <p className="text-sm text-slate-400 font-mono mt-1">Devices Connected</p>
                  </div>
                </div>
                <span className="text-3xl font-black text-white">
                  {telemetry.wifi_device_count}
                </span>
              </div>

              {/* Acoustic Truth Metric */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg flex items-center justify-between shadow-inner">
                <div className="flex items-center gap-3">
                  <Volume2
                    className={`h-8 w-8 ${telemetry.db_level > 85 ? "text-amber-500" : "text-slate-500"}`}
                  />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      Acoustic Triangulation (DSP)
                    </p>
                    <p className="text-sm text-slate-400 font-mono mt-1">Est. Human Vocal Energy</p>
                  </div>
                </div>
                <span className="text-3xl font-black text-amber-400">
                  {telemetry.db_level.toFixed(1)} dB
                </span>
              </div>

              {/* Calculated Density */}
              <div
                className={`p-5 rounded-lg border flex items-center justify-between transition-colors duration-500 ${telemetry.hazard_status === "CRITICAL_CRUSH_HAZARD" ? "bg-red-950/40 border-red-900/50" : "bg-slate-950 border-slate-800"}`}
              >
                <div className="flex items-center gap-3">
                  <Users
                    className={`h-8 w-8 ${telemetry.hazard_status === "CRITICAL_CRUSH_HAZARD" ? "text-red-500" : "text-slate-500"}`}
                  />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      Algorithm Crowd Estimate
                    </p>
                    <p className="text-sm font-mono mt-1 text-white">Physical Bodies in Room</p>
                  </div>
                </div>
                <span
                  className={`text-4xl font-black ${telemetry.hazard_status === "CRITICAL_CRUSH_HAZARD" ? "text-red-500" : "text-white"}`}
                >
                  {telemetry.estimated_crowd}
                </span>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-950/50 border-t border-slate-800 pt-5 mt-auto">
              <Button
                onClick={toggleSimulation}
                variant={isSimulatingRave ? "destructive" : "default"}
                className={`w-full font-black h-14 uppercase tracking-widest transition-all ${!isSimulatingRave ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
              >
                {isSimulatingRave
                  ? "Abort Simulation (Reset)"
                  : "Simulate 'Underground Rave' Evasion"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: DSP Visualization & Alerts */}
        <div className="lg:col-span-3 space-y-6 flex flex-col h-full">
          <Card
            className={`bg-slate-900 border-slate-800 shadow-2xl flex-1 transition-all duration-700 ${telemetry.hazard_status === "CRITICAL_CRUSH_HAZARD" ? "border-red-900/50 shadow-[0_0_50px_rgba(239,68,68,0.15)]" : ""}`}
          >
            <CardHeader
              className={`${telemetry.hazard_status === "CRITICAL_CRUSH_HAZARD" ? "bg-red-950/40" : "bg-slate-950/40"} border-b border-slate-800 pb-5 transition-colors duration-500`}
            >
              <CardTitle
                className={`flex items-center gap-3 text-xl ${telemetry.hazard_status === "CRITICAL_CRUSH_HAZARD" ? "text-red-500" : "text-white"}`}
              >
                {telemetry.hazard_status === "CRITICAL_CRUSH_HAZARD" ? (
                  <ShieldAlert className="h-6 w-6 animate-pulse" />
                ) : (
                  <ShieldCheck className="h-6 w-6 text-emerald-500" />
                )}
                {telemetry.hazard_status === "CRITICAL_CRUSH_HAZARD"
                  ? "CRITICAL CRUSH HAZARD DETECTED"
                  : "Venue Capacity Safe"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-8 space-y-8">
              {/* Fake Audio FFT Visualizer */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Live FFT Frequency Spectrum (300Hz - 3000Hz)
                </p>
                <div className="h-32 bg-slate-950 border border-slate-800 rounded-lg flex items-end justify-between p-2 gap-1 overflow-hidden">
                  {Array.from({ length: 40 }).map((_, i) => {
                    // Height based on crowd size to simulate pink noise vocal density
                    const densityFactor = Math.min(1, telemetry.estimated_crowd / 500);
                    const noise = Math.random() * 20;
                    const height = 10 + densityFactor * 80 + noise;
                    const isHigh = height > 70;
                    return (
                      <div
                        key={i}
                        className={`w-full rounded-t-sm transition-all duration-75 ${isHigh ? "bg-red-500" : "bg-amber-500/50"}`}
                        style={{ height: `${height}%` }}
                      />
                    );
                  })}
                </div>
              </div>

              {telemetry.hazard_status === "CRITICAL_CRUSH_HAZARD" && (
                <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-lg mt-8 flex flex-col gap-4 animate-in slide-in-from-bottom-4">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="h-8 w-8 text-red-500 shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-black text-red-500 uppercase tracking-wide">
                        Digital Evasion Detected
                      </h3>
                      <p className="text-sm text-red-200/80 leading-relaxed font-mono mt-2">
                        WARNING: Wi-Fi telemetry reports 0 devices, but acoustic DSP confirms{" "}
                        {telemetry.estimated_crowd} human bodies present in the room. This indicates
                        intentional network evasion (Airplane Mode).
                      </p>
                      <p className="text-sm text-red-200/80 leading-relaxed font-mono mt-2 font-bold">
                        Room capacity (100) exceeded by{" "}
                        {Math.round((telemetry.estimated_crowd / 100) * 100)}%. Dispatching
                        emergency management instantly.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {telemetry.hazard_status === "SAFE" && (
                <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-lg mt-8 flex items-start gap-4">
                  <CheckCircle2 className="h-6 w-6 text-slate-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-400 leading-relaxed font-mono">
                    Acoustic energy levels are stable. No abnormal human vocal density detected.
                    Digital and Physical telemetry are in consensus.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AcousticCrowdRadar;
