import React, { useState, useEffect } from 'react';
import {
  Thermometer,
  Flame,
  ShieldAlert,
  Brain,
  Wind,
  Users,
  Radio,
  Activity,
  Compass,
  MapPin,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HeartPulse,
  Sliders,
  VolumeX,
  Fan
} from 'lucide-react';
import {
  ThermalOvercrowdingService,
  MentalHealthThermalAnalysis,
  MentalHealthThermalRiskLevel,
  ThermostatReading,
  QuietZoneRecommendation
} from '@/services/thermalOvercrowdingService';

interface MentalHealthThermalOvercrowdingDetectorProps {
  venueId?: string;
  venueName?: string;
  capacity?: number;
}

export const MentalHealthThermalOvercrowdingDetector: React.FC<MentalHealthThermalOvercrowdingDetectorProps> = ({
  venueId = 'venue-main-auditorium',
  venueName = 'Main Student Union Auditorium',
  capacity = 200
}) => {
  // Simulator State
  const [ambientTemp, setAmbientTemp] = useState<number>(79.5);
  const [baselineTemp, setBaselineTemp] = useState<number>(70.0);
  const [occupancyCount, setOccupancyCount] = useState<number>(185);
  const [humidity, setHumidity] = useState<number>(62.0);
  const [heatRiseVelocity, setHeatRiseVelocity] = useState<number>(3.2);

  // Analysis State
  const [analysis, setAnalysis] = useState<MentalHealthThermalAnalysis | null>(null);
  const [telemetryLogs, setTelemetryLogs] = useState<ThermostatReading[]>([]);

  // Action States
  const [hvacActionStatus, setHvacActionStatus] = useState<string | null>(null);
  const [broadcastSent, setBroadcastSent] = useState<boolean>(false);
  const [redirectedVenue, setRedirectedVenue] = useState<string | null>(null);

  // Run analysis calculation whenever simulation parameters change
  useEffect(() => {
    const result = ThermalOvercrowdingService.analyzeMentalHealthThermalRisk(
      venueId,
      ambientTemp,
      baselineTemp,
      occupancyCount,
      capacity,
      humidity,
      heatRiseVelocity
    );
    setAnalysis(result);
    setTelemetryLogs(ThermalOvercrowdingService.generateMockTelemetry(venueId));
  }, [venueId, ambientTemp, baselineTemp, occupancyCount, capacity, humidity, heatRiseVelocity]);

  // Handle Manual HVAC Max Cooling Dispatch
  const handleTriggerHVAC = async () => {
    if (!analysis) return;
    const res = await ThermalOvercrowdingService.triggerHVACOverride(venueId, 67.0);
    setHvacActionStatus(res.message);
    // Cool down ambient temp in simulation
    setAmbientTemp((prev) => Math.max(68, prev - 3.5));
    setHeatRiseVelocity(0.5);
  };

  // Handle Quiet-Zone Broadcast
  const handleBroadcastRedirect = async () => {
    const res = await ThermalOvercrowdingService.broadcastQuietZoneRedirect(venueId);
    if (res.success) {
      setBroadcastSent(true);
    }
  };

  // Badge styling depending on risk level
  const getRiskBadge = (level: MentalHealthThermalRiskLevel) => {
    switch (level) {
      case 'CRITICAL_SENSORY_OVERLOAD':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-500 animate-ping',
          label: 'CRITICAL SENSORY OVERLOAD',
          description: 'High risk of heat-induced panic, sensory fatigue & anxiety'
        };
      case 'ELEVATED':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-500 animate-pulse',
          label: 'ELEVATED SENSORY RISK',
          description: 'Elevated temperature & crowding starting to degrade attendee comfort'
        };
      case 'MODERATE':
        return {
          bg: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
          dot: 'bg-yellow-500',
          label: 'MODERATE THERMAL LOAD',
          description: 'Occupancy rising; thermal accumulation noticeable'
        };
      default:
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-500',
          label: 'NOMINAL COMFORT ZONE',
          description: 'Optimal temperature & crowd density balance'
        };
    }
  };

  if (!analysis) return null;

  const riskBadge = getRiskBadge(analysis.risk_level);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-slate-100 p-4 font-sans">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 border border-indigo-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Brain className="w-3.5 h-3.5" /> Dynamic Mental Health Protection
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Telemetry
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Flame className="w-8 h-8 text-rose-400 animate-pulse" />
              Thermal Overcrowding & Sensory Detector
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Monitors venue thermal spikes and crowd density to prevent heat-induced sensory overload, panic responses, and anxiety triggers in real time.
            </p>
          </div>

          <div className="flex flex-col items-end justify-center">
            <div className="text-xs text-slate-400 font-mono">Target Venue</div>
            <div className="text-lg font-bold text-indigo-200">{venueName}</div>
            <div className="text-xs text-slate-400">Capacity: {capacity} Seats</div>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sensory Overload Gauge & Risk Meter */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-2xl bg-slate-900/80 backdrop-blur border border-slate-800 p-6 shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
            <div className="w-full flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-rose-400" /> Sensory Overload Risk Score
              </h3>
              <span className="text-xs text-slate-400 font-mono">Formula v2.4</span>
            </div>

            {/* Circular Meter Display */}
            <div className="relative w-48 h-48 flex items-center justify-center my-2">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${(analysis.sensory_overload_index / 100) * 263.8} 263.8`}
                  strokeLinecap="round"
                  className={`transition-all duration-700 ${
                    analysis.sensory_overload_index >= 80
                      ? 'text-rose-500'
                      : analysis.sensory_overload_index >= 60
                      ? 'text-amber-500'
                      : analysis.sensory_overload_index >= 35
                      ? 'text-yellow-400'
                      : 'text-emerald-400'
                  }`}
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-extrabold tracking-tight text-white">
                  {analysis.sensory_overload_index}
                  <span className="text-xl text-slate-400 font-normal">%</span>
                </span>
                <span className="text-xs font-semibold text-slate-400 mt-0.5">SENSORY RISK</span>
              </div>
            </div>

            {/* Risk Badge */}
            <div className={`w-full mt-4 p-3 rounded-xl border flex flex-col items-center text-center ${riskBadge.bg}`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                <span className={`w-2.5 h-2.5 rounded-full ${riskBadge.dot}`} />
                {riskBadge.label}
              </div>
              <p className="text-xs mt-1 text-slate-300">{riskBadge.description}</p>
            </div>

            {/* Anxiety Trigger Probability Bar */}
            <div className="w-full mt-4 bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" /> Anxiety Trigger Probability
                </span>
                <span className="font-bold font-mono text-indigo-300">
                  {Math.round(analysis.anxiety_trigger_probability * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 transition-all duration-500"
                  style={{ width: `${Math.round(analysis.anxiety_trigger_probability * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Environmental Telemetry Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Ambient Temp</span>
                <Thermometer className="w-4 h-4 text-rose-400" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-white">{analysis.current_temp.toFixed(1)}°F</span>
                <span className="text-xs text-rose-400 ml-2 font-mono">+{analysis.temp_delta.toFixed(1)}°F spike</span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Occupancy Ratio</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-white">{Math.round(analysis.occupancy_ratio * 100)}%</span>
                <span className="text-xs text-slate-400 ml-2 font-mono">
                  {analysis.occupancy_count}/{analysis.occupancy_capacity}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Heat Rise Speed</span>
                <Flame className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-white">+{analysis.heat_rise_rate_per_10min}°F</span>
                <span className="text-xs text-slate-400 ml-2">per 10 mins</span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Heat Index</span>
                <Wind className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-white">{analysis.heat_index.toFixed(1)}°F</span>
                <span className="text-xs text-cyan-300 ml-2 font-mono">{analysis.humidity_percent}% RH</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interventions & Quiet Zone Redirection */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Automated De-escalation Interventions Panel */}
          <div className="rounded-2xl bg-slate-900/80 backdrop-blur border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-400" /> Automated De-Escalation & Relief Dispatch
              </h3>
              <span className="text-xs text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                Mental Health Safeguards
              </span>
            </div>

            <div className="space-y-2">
              {analysis.recommended_interventions.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs text-slate-200"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {/* Quick Action Trigger Buttons */}
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={handleTriggerHVAC}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-indigo-600/20 active:scale-95"
              >
                <Fan className="w-4 h-4 animate-spin" /> Dispatch Max HVAC Cooling (67°F)
              </button>

              <button
                onClick={handleBroadcastRedirect}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition active:scale-95 ${
                  broadcastSent
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                <Radio className="w-4 h-4 text-rose-400" />
                {broadcastSent ? 'Quiet Zone Broadcast Dispatched' : 'Broadcast Quiet Zone Alert'}
              </button>
            </div>

            {hvacActionStatus && (
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-200">
                {hvacActionStatus}
              </div>
            )}
          </div>

          {/* Sensory Safe Quiet Zone Finder */}
          <div className="rounded-2xl bg-slate-900/80 backdrop-blur border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Compass className="w-5 h-5 text-emerald-400" /> Nearby Sensory Relief & Quiet Zones
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated redirection recommendations for attendees experiencing anxiety or sensory distress.
                </p>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                3 Zones Safe
              </span>
            </div>

            <div className="space-y-3">
              {analysis.suggested_quiet_zones.map((zone) => (
                <div
                  key={zone.venue_id}
                  className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:border-emerald-500/40 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{zone.name}</span>
                      <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                        <VolumeX className="w-3 h-3" /> Sensory Safe
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" /> {zone.location_description}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-300 font-mono mt-1">
                      <span>Temp: {zone.current_temp}°F</span>
                      <span>•</span>
                      <span>Occupancy: {Math.round(zone.occupancy_ratio * 100)}%</span>
                      <span>•</span>
                      <span>Distance: {zone.distance_meters}m</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setRedirectedVenue(zone.name)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition shrink-0 ${
                      redirectedVenue === zone.name
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    }`}
                  >
                    {redirectedVenue === zone.name ? 'Attendee Redirected ✓' : 'Guide Attendee Here'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Interactive Environment Simulator Bar */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Interactive Environmental & Crowding Simulator
            </h3>
          </div>
          <button
            onClick={() => {
              setAmbientTemp(72.0);
              setOccupancyCount(100);
              setHumidity(45);
              setHeatRiseVelocity(0.8);
            }}
            className="flex items-center gap-1 text-xs text-indigo-300 hover:text-white transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset to Nominal
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
          {/* Ambient Temp Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-300">Ambient Temp (°F)</span>
              <span className="text-rose-400 font-mono font-bold">{ambientTemp}°F</span>
            </div>
            <input
              type="range"
              min="68"
              max="90"
              step="0.5"
              value={ambientTemp}
              onChange={(e) => setAmbientTemp(parseFloat(e.target.value))}
              className="w-full accent-rose-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>68°F</span>
              <span>78°F (Alert)</span>
              <span>90°F</span>
            </div>
          </div>

          {/* Occupancy Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-300">Venue Occupancy</span>
              <span className="text-indigo-400 font-mono font-bold">
                {occupancyCount} / {capacity}
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="300"
              step="5"
              value={occupancyCount}
              onChange={(e) => setOccupancyCount(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>50 (25%)</span>
              <span>200 (100%)</span>
              <span>300 (150%)</span>
            </div>
          </div>

          {/* Humidity Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-300">Humidity (%)</span>
              <span className="text-cyan-400 font-mono font-bold">{humidity}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="90"
              step="1"
              value={humidity}
              onChange={(e) => setHumidity(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>30%</span>
              <span>60%</span>
              <span>90%</span>
            </div>
          </div>

          {/* Heat Rise Speed Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-300">Heat Rise (°F/10min)</span>
              <span className="text-amber-400 font-mono font-bold">+{heatRiseVelocity}°F</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="6.0"
              step="0.2"
              value={heatRiseVelocity}
              onChange={(e) => setHeatRiseVelocity(parseFloat(e.target.value))}
              className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>+0.2°F</span>
              <span>+3.0°F</span>
              <span>+6.0°F</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MentalHealthThermalOvercrowdingDetector;
