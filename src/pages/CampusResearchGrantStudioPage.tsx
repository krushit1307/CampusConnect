import React, { useState } from 'react';
import {
  CampusResearchGrantService,
  ResearchGrantFund,
  SharedLabEquipment,
  LabEquipmentReservation,
} from '../../backend/src/services/CampusResearchGrantService';

export const CampusResearchGrantStudioPage: React.FC = () => {
  const [grants] = useState<ResearchGrantFund[]>(
    CampusResearchGrantService.getGrants()
  );
  const [equipment, setEquipment] = useState<SharedLabEquipment[]>(
    CampusResearchGrantService.getEquipment()
  );
  const [reservations, setReservations] = useState<LabEquipmentReservation[]>(
    CampusResearchGrantService.getReservations('STU-999')
  );

  const [selectedEq, setSelectedEq] = useState<SharedLabEquipment | null>(null);
  const [researcherName, setResearcherName] = useState<string>('Alex Rivera');
  const [grantId, setGrantId] = useState<string>('GRANT-NSF-801');
  const [reservationDate, setReservationDate] = useState<string>('2026-08-27');
  const [startTime, setStartTime] = useState<string>('14:00');
  const [durationHours, setDurationHours] = useState<number>(2);

  const metrics = CampusResearchGrantService.getResearchMetrics();

  const handleReserveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEq) return;

    const newRes = CampusResearchGrantService.reserveEquipment(
      selectedEq.equipmentId,
      'STU-999',
      researcherName,
      grantId,
      reservationDate,
      startTime,
      durationHours
    );

    setReservations([newRes, ...reservations]);
    setEquipment([...CampusResearchGrantService.getEquipment()]);
    setSelectedEq(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Campus Research Grants & Shared Labs
            </span>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-3 py-1 rounded-full font-mono">
              Inter-Departmental Equipment Telemetry
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Research Grant & Shared Lab Equipment Studio
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Book high-precision shared lab instrumentation (Electron Microscopes, DNA Sequencers, Supercomputers) funded by active NSF and NIH grants.
          </p>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Grant Funding</span>
          <div className="text-2xl md:text-3xl font-black text-purple-400 mt-1">
            ${(metrics.totalGrantsFundingUsd / 1000000).toFixed(2)}M
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">NSF, NIH, DoD Grants Active</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shared Lab Instruments</span>
          <div className="text-2xl md:text-3xl font-black text-emerald-400 mt-1">
            {metrics.activeEquipmentCount} Units Online
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Calibrated & Certified</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lab Hours Utilized</span>
          <div className="text-2xl md:text-3xl font-black text-indigo-400 mt-1">
            {metrics.totalHoursDelivered} Hours
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Cross-Department Research</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Reservations</span>
          <div className="text-2xl md:text-3xl font-black text-blue-400 mt-1">
            {metrics.activeReservationsCount} Bookings
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Scheduled Research Time</span>
        </div>
      </div>

      {/* Grants Overview */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-black text-white">Active Campus Research Grants</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {grants.map((g) => (
            <div key={g.grantId} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-400 font-mono">{g.grantId}</span>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                  {g.grantStatus}
                </span>
              </div>
              <h3 className="font-bold text-white text-sm">{g.projectTitle}</h3>
              <p className="text-slate-400">PI: {g.principalInvestigator} • {g.department}</p>
              <div className="flex justify-between items-center text-slate-300 pt-2 border-t border-slate-900">
                <span>Sponsor: {g.sponsorOrganization}</span>
                <span className="font-black text-purple-400">${g.remainingAmountUsd.toLocaleString()} / ${g.allocatedAmountUsd.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lab Equipment Catalog */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {equipment.map((item) => (
          <div
            key={item.equipmentId}
            className="bg-slate-900/80 backdrop-blur-md border border-slate-800 hover:border-purple-500/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-all space-y-4"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-3 py-1 rounded-full">
                  {item.category.replace('_', ' ')}
                </span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
                  {item.hourlyBookingTokens} Tokens/hr
                </span>
              </div>

              <h3 className="text-xl font-black text-white">{item.name}</h3>
              <p className="text-xs text-slate-400 mb-3">📍 {item.departmentLocation}</p>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span>Required Safety Level:</span>
                  <span className="font-bold text-amber-400">{item.safetyLevelRequired}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Operational Utilization:</span>
                  <span className="font-bold text-indigo-400">{item.totalHoursUtilized} Hours</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedEq(item)}
              className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-lg hover:shadow-purple-500/20"
            >
              Reserve Instrumentation Time
            </button>
          </div>
        ))}
      </div>

      {/* Active Reservations */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-black text-white">Your Scheduled Lab Equipment Time Slots</h2>
        <div className="space-y-3">
          {reservations.map((r) => (
            <div
              key={r.reservationId}
              className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-purple-400">{r.equipmentName}</span>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                    {r.status}
                  </span>
                </div>
                <p className="text-slate-300">Researcher: {r.researcherName} | Date: {r.reservationDate} at {r.startTime} ({r.durationHours} Hours)</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Funding Grant: {r.grantId} • Safety Verification Passed ✅</p>
              </div>

              <span className="text-xs font-bold text-purple-300 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-xl">
                Cleanroom Pass Granted 🔬
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Reservation Modal */}
      {selectedEq && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleReserveSubmit}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl"
          >
            <h2 className="text-xl font-bold text-white">Reserve Lab Equipment: {selectedEq.name}</h2>
            <p className="text-xs text-slate-400">Location: {selectedEq.departmentLocation} | Rate: {selectedEq.hourlyBookingTokens} Tokens/hr</p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Principal Researcher Name</label>
              <input
                type="text"
                value={researcherName}
                onChange={(e) => setResearcherName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Associated Research Grant</label>
              <select
                value={grantId}
                onChange={(e) => setGrantId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              >
                {grants.map((g) => (
                  <option key={g.grantId} value={g.grantId}>
                    {g.grantId} - {g.projectTitle}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Date</label>
                <input
                  type="date"
                  value={reservationDate}
                  onChange={(e) => setReservationDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Duration (Hrs)</label>
                <input
                  type="number"
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                  min={1}
                  max={8}
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedEq(null)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 font-bold text-xs hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-1/2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
              >
                Confirm Reservation & Verify Clearance
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
