import React from 'react';
import { LabEquipment } from '@/types/labEquipment';
import { Cpu, Zap, Flame, Activity, Server, Radio } from 'lucide-react';

interface HardwareTelemetryDashboardProps {
  equipmentList: LabEquipment[];
}

export function HardwareTelemetryDashboard({
  equipmentList,
}: HardwareTelemetryDashboardProps) {
  const telemetryEquipment = equipmentList.filter((e) => e.telemetry);

  return (
    <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-6">
      <div className="flex items-center justify-between border-b-2 border-black pb-4">
        <div>
          <h3 className="font-display font-black text-xl text-black flex items-center gap-2">
            <Activity size={22} className="text-blue-600" /> Live Hardware Telemetry & Sensor Grid
          </h3>
          <p className="font-mono text-xs text-gray-600">
            Real-time compute load, temperature thermals, and power consumption for active cluster nodes.
          </p>
        </div>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-green-100 text-green-800 border border-green-300">
          <Radio size={12} className="text-green-600 animate-pulse" /> Telemetry Active (1s Poll)
        </span>
      </div>

      {/* Telemetry Node Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {telemetryEquipment.map((eq) => {
          const t = eq.telemetry!;
          const isHighTemp = t.temperatureCelsius > 75;

          return (
            <div
              key={eq.id}
              className="p-5 bg-slate-900 border-2 border-black rounded-lg text-white space-y-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display font-black text-base text-white">
                    {eq.name}
                  </div>
                  <div className="font-mono text-xs text-gray-400">{eq.labLocation}</div>
                </div>
                <Server size={18} className="text-lime" />
              </div>

              {/* Specs Badge */}
              <div className="font-mono text-[10px] text-gray-300 bg-slate-800 p-2 rounded border border-slate-700">
                {Object.entries(eq.specs)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' • ')}
              </div>

              {/* Metrics Grid */}
              <div className="space-y-3 font-mono text-xs">
                {/* Compute Load */}
                <div>
                  <div className="flex justify-between text-gray-400 mb-1">
                    <span className="flex items-center gap-1"><Cpu size={12} /> GPU Utilization</span>
                    <span className="font-bold text-white">{t.utilizationPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className="h-full bg-lime transition-all duration-500"
                      style={{ width: `${t.utilizationPercent}%` }}
                    />
                  </div>
                </div>

                {/* Thermals */}
                <div className="flex justify-between items-center pt-1">
                  <span className="flex items-center gap-1 text-gray-400">
                    <Flame size={12} className={isHighTemp ? 'text-red-400' : 'text-amber-400'} /> Core Temp
                  </span>
                  <span className={`font-bold ${isHighTemp ? 'text-red-400' : 'text-emerald-400'}`}>
                    {t.temperatureCelsius}°C
                  </span>
                </div>

                {/* Power */}
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 text-gray-400">
                    <Zap size={12} className="text-amber-400" /> Power Draw
                  </span>
                  <span className="font-bold text-amber-300">{t.powerWattage}W</span>
                </div>
              </div>

              {t.currentJobName && (
                <div className="font-mono text-[10px] text-gray-400 pt-2 border-t border-slate-800 truncate">
                  Active Job: <strong className="text-lime">{t.currentJobName}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
