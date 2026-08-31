import React, { useState, useEffect } from 'react';
import {
  HardwareAsset,
  HardwareBooking,
  RfidGateScanEvent,
  RfidSecurityEvaluationResult,
  StudentFinancialLedgerPenalty,
} from '../../types/rfidHardwareCheckout';
import { rfidHardwareCheckoutService } from '../../services/rfidHardwareCheckoutService';

export const RfidHardwareCheckoutTerminal: React.FC = () => {
  const [assets, setAssets] = useState<HardwareAsset[]>([]);
  const [bookings, setBookings] = useState<HardwareBooking[]>([]);
  const [penalties, setPenalties] = useState<StudentFinancialLedgerPenalty[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [selectedGate, setSelectedGate] = useState<string>('gate-union-exit-01');
  const [studentIdInput, setStudentIdInput] = useState<string>('std_alice_902');
  const [detectionMethod, setDetectionMethod] = useState<'rfid_badge' | 'facial_recognition_camera' | 'pin_pad'>('facial_recognition_camera');
  const [evalResult, setEvalResult] = useState<RfidSecurityEvaluationResult | null>(null);
  const [doorStatus, setDoorStatus] = useState<{ isLocked: boolean; lockReason: string }>(
    rfidHardwareCheckoutService.getDoorLockStatus()
  );
  const [loading, setLoading] = useState(false);

  const refreshData = async () => {
    const a = await rfidHardwareCheckoutService.getAssets();
    const b = await rfidHardwareCheckoutService.getBookings();
    const p = await rfidHardwareCheckoutService.getPenalties();
    setAssets(a);
    setBookings(b);
    setPenalties(p);
    setDoorStatus(rfidHardwareCheckoutService.getDoorLockStatus());
    if (a.length > 0 && !selectedAssetId) {
      setSelectedAssetId(a[0].id);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleSimulateGateScan = async (isAuthorizedSim: boolean) => {
    setLoading(true);
    const targetAsset = assets.find((a) => a.id === selectedAssetId);
    if (!targetAsset) {
      setLoading(false);
      return;
    }

    const testStudentId = isAuthorizedSim ? 'std_alice_902' : 'std_unauthorized_thief_772';

    const scanEvent: RfidGateScanEvent = {
      id: `scan-${Date.now()}`,
      gateId: selectedGate,
      gateLocation: 'Student Union Hardware Library - East Exit Portal',
      rfidTagEpc: targetAsset.rfidTagEpc,
      antennaNumber: 1,
      rssi: -42.5,
      scanTimestamp: new Date().toISOString(),
      identifiedStudentId: testStudentId,
      identificationMethod: detectionMethod,
      cameraSnapshotUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    };

    const result = await rfidHardwareCheckoutService.processRfidGateScan(scanEvent);
    setEvalResult(result);
    await refreshData();
    setLoading(false);
  };

  const handleUnlockDoors = () => {
    rfidHardwareCheckoutService.unlockExteriorDoors('ADMIN-STAFF-01', 'Security review verified false alarm or resolved incident');
    refreshData();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              EPC Gen2 RFID Gateway
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Hardware Security Active
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">RFID Automated Checkout & Loss Prevention</h2>
          <p className="text-sm text-slate-400">
            Real-time physical asset tracking, perimeter security locks, and automated financial deterrence
          </p>
        </div>

        {/* Door Lockdown Status Badge */}
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${
          doorStatus.isLocked
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
        }`}>
          <div className={`w-3 h-3 rounded-full animate-pulse ${doorStatus.isLocked ? 'bg-rose-500' : 'bg-emerald-500'}`} />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">Perimeter Doors</div>
            <div className="text-sm font-semibold">{doorStatus.isLocked ? '🔒 LOCKED (SECURITY BREACH)' : '🔓 UNLOCKED / SECURE'}</div>
          </div>
          {doorStatus.isLocked && (
            <button
              onClick={handleUnlockDoors}
              className="ml-2 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition"
            >
              Reset / Unlock
            </button>
          )}
        </div>
      </div>

      {/* Simulator Control Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Asset Selection & Gate Sensor Simulation */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            📡 Physical Gate Webhook Simulator
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Select Hardware Asset to Scan</label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} (${asset.valuationUsd}) - [{asset.rfidTagEpc.slice(0, 12)}...]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Gate Reader Location</label>
            <select
              value={selectedGate}
              onChange={(e) => setSelectedGate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="gate-union-exit-01">Student Union Exit (Portal Gate #1)</option>
              <option value="gate-robotics-lab-02">Robotics & Drone Flight Bay (Exit #2)</option>
              <option value="gate-maker-space-03">MakerSpace East Corridor</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Student Identification Method</label>
            <select
              value={detectionMethod}
              onChange={(e) => setDetectionMethod(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="facial_recognition_camera">Facial Recognition Camera</option>
              <option value="rfid_badge">Student ID NFC/RFID Badge</option>
              <option value="pin_pad">Keypad PIN Access</option>
            </select>
          </div>

          <div className="pt-2 space-y-2">
            <button
              onClick={() => handleSimulateGateScan(true)}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-lg transition flex items-center justify-center gap-2"
            >
              <span>✅</span> Simulate Authorized Checkout (Alice)
            </button>
            <button
              onClick={() => handleSimulateGateScan(false)}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-lg transition flex items-center justify-center gap-2"
            >
              <span>🚨</span> Simulate Unauthorized Walkout (Theft Attempt)
            </button>
          </div>
        </div>

        {/* Center Column: Real-Time Gate Security Response */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            🛡️ Automated Security Response
          </h3>

          {evalResult ? (
            <div className={`p-4 rounded-xl border space-y-3 ${
              evalResult.isAuthorized
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-base">
                  {evalResult.isAuthorized ? 'Access Authorized' : 'Security Breach Detected!'}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  evalResult.isAuthorized ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                }`}>
                  {evalResult.actionTaken}
                </span>
              </div>

              <p className="text-xs leading-relaxed opacity-90">{evalResult.message}</p>

              {!evalResult.isAuthorized && evalResult.penaltyApplied && (
                <div className="bg-rose-900/40 p-3 rounded-lg border border-rose-600/30 text-xs space-y-1">
                  <div className="font-bold text-rose-300">⚡ Automated Deterrence Actions:</div>
                  <div>• Exterior doors locked instantly</div>
                  <div>• Silent perimeter alarm broadcast to campus dispatch</div>
                  <div>• Autonomous safety drone launched to Union exit</div>
                  <div className="text-rose-400 font-bold">
                    • ${evalResult.penaltyApplied.penaltyAmountUsd} Penalty charged to Student Ledger
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 border border-dashed border-slate-700 rounded-xl text-sm">
              Pass an RFID tag through the gate reader simulator to view low-latency authorization telemetry.
            </div>
          )}

          {/* Active Registered Hardware Assets */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Inventory Status</div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {assets.map((asset) => (
                <div key={asset.id} className="p-2.5 bg-slate-900/70 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-200">{asset.name}</div>
                    <div className="text-slate-400">EPC: {asset.rfidTagEpc.slice(0, 16)}...</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-medium ${
                    asset.status === 'available' ? 'bg-blue-500/10 text-blue-400' :
                    asset.status === 'checked_out' ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-rose-500/10 text-rose-400'
                  }`}>
                    {asset.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Student Financial Ledger & Penalties */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            💳 Financial Ledger & Penalties
          </h3>

          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent Automated Penalties</div>
            {penalties.length === 0 ? (
              <div className="p-6 text-center text-slate-400 border border-dashed border-slate-700 rounded-xl text-xs">
                No unauthorized removal penalties recorded.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {penalties.map((penalty) => (
                  <div key={penalty.id} className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between font-bold text-rose-300">
                      <span>{penalty.studentName}</span>
                      <span>-${penalty.amountUsd}.00</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{penalty.reason}</p>
                    <div className="text-slate-400 text-[10px] flex justify-between">
                      <span>Status: {penalty.status}</span>
                      <span>{new Date(penalty.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
