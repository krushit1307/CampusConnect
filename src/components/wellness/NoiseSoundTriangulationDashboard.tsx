import React, { useState } from 'react';
import { NoiseComplaintIncident } from '../../types/noiseSoundTriangulation';
import { noiseSoundTriangulationService } from '../../services/noiseSoundTriangulationService';

export const NoiseSoundTriangulationDashboard: React.FC = () => {
  const [incidents, setIncidents] = useState<NoiseComplaintIncident[]>(
    noiseSoundTriangulationService.getIncidents()
  );
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(incidents[0]?.id || '');
  const [loudnessPreset, setLoudnessPreset] = useState<'extreme_loud' | 'moderate_ambient' | 'quiet'>('extreme_loud');
  const [triangulating, setTriangulating] = useState<boolean>(false);

  const activeIncident = incidents.find((i) => i.id === selectedIncidentId) || incidents[0];

  const handleRunTriangulation = async () => {
    setTriangulating(true);
    try {
      await noiseSoundTriangulationService.executeMobileSoundTriangulation(
        activeIncident.id,
        loudnessPreset
      );
      setIncidents([...noiseSoundTriangulationService.getIncidents()]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTriangulating(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              🎙️ Distributed Mic Array Telemetry
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              Empirical Decibel Triangulation
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">Noise Complaint Sound Level Triangulation</h2>
          <p className="text-sm text-slate-400">
            Crowdsourced 2-second acoustic dBfs sampling across checked-in attendees to verify disturbance claims
          </p>
        </div>

        {/* Verification Status Banner */}
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${
          activeIncident?.status === 'VERIFIED_VIOLATION'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : activeIncident?.status === 'UNVERIFIED_DISMISSED'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          <div className="w-3 h-3 rounded-full bg-current animate-pulse" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Empirical Verification</div>
            <div className="text-xs font-bold">{activeIncident?.status.replace('_', ' ')}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Incident Details & Acoustic Triangulation Control */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Columns: Incident Card & Trigger Simulator */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                📋 Complaint Incident #{activeIncident?.id}
              </h3>
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">
                {activeIncident?.complaintsCount} Neighbor Reports
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-400">Target Event:</span>
                <span className="font-semibold text-white">{activeIncident?.eventName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-400">Venue / Location:</span>
                <span className="text-slate-200">{activeIncident?.venueRoom}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-400">Organizer:</span>
                <span className="text-slate-200">{activeIncident?.organizerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-700/60">
                <span className="text-slate-400">Permissible Threshold:</span>
                <span className="font-mono font-bold text-amber-400">&lt; {activeIncident?.thresholdMaxDb} dB</span>
              </div>
            </div>

            {/* Simulation Preset Selector */}
            <div className="pt-2 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Simulated Room Acoustic Level:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setLoudnessPreset('extreme_loud')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                    loudnessPreset === 'extreme_loud'
                      ? 'bg-rose-600/30 border-rose-500 text-rose-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  🔊 105 dB (Rave)
                </button>
                <button
                  onClick={() => setLoudnessPreset('moderate_ambient')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                    loudnessPreset === 'moderate_ambient'
                      ? 'bg-amber-600/30 border-amber-500 text-amber-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  🔉 82 dB (Party)
                </button>
                <button
                  onClick={() => setLoudnessPreset('quiet')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                    loudnessPreset === 'quiet'
                      ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  🔈 55 dB (Quiet)
                </button>
              </div>
            </div>

            <button
              onClick={handleRunTriangulation}
              disabled={triangulating}
              className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
            >
              <span>{triangulating ? '📡' : '⚡'}</span>
              {triangulating ? 'Triangulating 5 Mobile Mics...' : 'Push Silent Mic Triangulation Command'}
            </button>
          </div>
        </div>

        {/* Right 7 Columns: Real-Time Mobile Decibel Readings & Police Dispatch Ticket */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              📊 5-Node Mobile Acoustic Telemetry (dBfs & SPL)
            </h3>

            {activeIncident?.crowdsourcedReadings.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-700 rounded-xl text-xs">
                Click "Push Silent Mic Triangulation Command" to sample 5 random attendees' phones.
              </div>
            ) : (
              <div className="space-y-3">
                {/* 5 Individual Phone Readings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeIncident.crowdsourcedReadings.map((reading, idx) => (
                    <div
                      key={reading.attendeeId}
                      className="p-3 bg-slate-900/80 border border-slate-700/70 rounded-xl space-y-1 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-white">
                          📱 Node #{idx + 1}: {reading.attendeeName}
                        </span>
                        <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                          reading.calculatedSplDb > 100
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {reading.calculatedSplDb} dB
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex justify-between">
                        <span>Device: {reading.deviceModel}</span>
                        <span>Raw: {reading.measuredDbfs} dBFS</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Aggregated Decibel Bar */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-300">Triangulated Average Sound Level:</span>
                    <span className={`text-base font-mono ${
                      activeIncident.triangulatedAverageDb > 100 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {activeIncident.triangulatedAverageDb} dB SPL
                    </span>
                  </div>

                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex relative">
                    <div
                      className={`transition-all duration-700 ${
                        activeIncident.triangulatedAverageDb > 100 ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, (activeIncident.triangulatedAverageDb / 130) * 100)}%` }}
                    />
                    {/* 100 dB Threshold Line */}
                    <div className="absolute top-0 bottom-0 left-[76.9%] w-0.5 bg-amber-400" title="100dB Limit" />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>0 dB (Silence)</span>
                    <span className="text-amber-400 font-bold">100 dB Limit</span>
                    <span>130 dB (Threshold of Pain)</span>
                  </div>
                </div>

                {/* Police Dispatch Ticket Append */}
                {activeIncident.policeDispatchTicket && (
                  <div className="p-4 bg-slate-900 border border-cyan-500/40 rounded-xl text-xs space-y-2 shadow-xl">
                    <div className="flex items-center justify-between font-bold text-cyan-300">
                      <span className="flex items-center gap-1.5">
                        <span>🚔</span> Campus Police Dispatch Ticket ({activeIncident.policeDispatchTicket.ticketId})
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-200">
                        {activeIncident.policeDispatchTicket.dispatchPriority}
                      </span>
                    </div>
                    <p className="text-slate-200 font-mono text-[11px] bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      &gt; "{activeIncident.policeDispatchTicket.empiricalDataSummary}"
                    </p>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Assigned: {activeIncident.policeDispatchTicket.assignedOfficer}</span>
                      <span>{new Date(activeIncident.policeDispatchTicket.generatedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
