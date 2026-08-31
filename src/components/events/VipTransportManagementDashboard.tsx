import React, { useState } from "react";
import {
  Car,
  Plane,
  ShieldCheck,
  UserCheck,
  Building2,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  FileText,
  CreditCard,
  MessageSquare,
  RefreshCw,
  Zap,
} from "lucide-react";
import { vipTransportService } from "@/services/vipTransport/vipTransportService";
import { VipTransportRequest } from "@/types/vipTransport";
import { Link } from "react-router-dom";

export function VipTransportManagementDashboard() {
  const [requests, setRequests] = useState<VipTransportRequest[]>(() =>
    vipTransportService.getRequests(),
  );
  const [selectedRequest, setSelectedRequest] = useState<VipTransportRequest | null>(
    requests[0] || null,
  );
  const [isProcessing, setIsProcessing] = useState(false);

  // Form states
  const [speakerName, setSpeakerName] = useState("Dr. Aris Thorne");
  const [speakerEmail, setSpeakerEmail] = useState("thorne@ai-research.org");
  const [carrier, setCarrier] = useState("AA");
  const [flightNumber, setFlightNumber] = useState("1042");
  const [terminal, setTerminal] = useState("Terminal 2");

  const refreshRequests = () => {
    const updated = vipTransportService.getRequests();
    setRequests(updated);
  };

  const handleDesignateVip = () => {
    const newReq = vipTransportService.designateVipSpeaker(
      "evt_ai_summit_2026",
      "Annual Campus AI & Robotics Summit",
      `spk_${Date.now()}`,
      speakerName,
      speakerEmail,
      "+1 (555) 345-6789",
    );

    vipTransportService.linkFlightItinerary(newReq.requestId, carrier, flightNumber, terminal);
    setSelectedRequest(newReq);
    refreshRequests();
  };

  const handleSimulateArrivalAndDispatch = async () => {
    if (!selectedRequest) return;
    setIsProcessing(true);

    try {
      const updated = await vipTransportService.trackFlightAndDispatchVehicle(
        selectedRequest.requestId,
      );
      setSelectedRequest(updated);
      refreshRequests();
    } catch (err) {
      console.error("Dispatch simulation failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <Link
              to="/dashboard"
              className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </Link>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Car className="w-8 h-8 text-cyan-400" />
              VIP Event Schedule Public Transit & Autonomous Fleet Sync
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Flight Arrival Tracking, Waymo Driverless Autonomous Pickup & Club Escrow Billing
              Integration
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-cyan-950/80 text-cyan-400 border border-cyan-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> DRIVERLESS FLEET INTEGRATED
            </span>
          </div>
        </div>

        {/* Control Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: VIP Speaker & Flight Itinerary Setup */}
          <div className="lg:col-span-1 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-cyan-400" /> Designate Speaker & Flight
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  VIP Keynote Speaker
                </label>
                <input
                  type="text"
                  value={speakerName}
                  onChange={(e) => setSpeakerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  Speaker Email
                </label>
                <input
                  type="email"
                  value={speakerEmail}
                  onChange={(e) => setSpeakerEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">Carrier</label>
                  <input
                    type="text"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">
                    Flight No.
                  </label>
                  <input
                    type="text"
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  Arrival Terminal
                </label>
                <input
                  type="text"
                  value={terminal}
                  onChange={(e) => setTerminal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                onClick={handleDesignateVip}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4" /> Link VIP Flight Itinerary
              </button>
            </div>
          </div>

          {/* Right Column: Fleet Dispatch & Status Monitor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Dispatch Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Plane className="w-4 h-4 text-cyan-400" /> Flight & Autonomous Fleet Dispatch
                  Monitor
                </h3>
                {selectedRequest && (
                  <span className="text-xs font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 px-2.5 py-1 rounded font-bold">
                    Status: {selectedRequest.status}
                  </span>
                )}
              </div>

              {selectedRequest ? (
                <div className="space-y-4">
                  {/* Speaker & Flight Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">VIP Speaker</span>
                      <p className="font-bold text-white text-sm">{selectedRequest.speakerName}</p>
                      <span className="text-slate-400">{selectedRequest.speakerEmail}</span>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Flight Itinerary</span>
                      <p className="font-bold text-cyan-400 text-sm">
                        {selectedRequest.flightItinerary?.flightNumber} (
                        {selectedRequest.flightItinerary?.arrivalAirport})
                      </p>
                      <span className="text-slate-400">
                        {selectedRequest.flightItinerary?.terminal}
                      </span>
                    </div>
                  </div>

                  {/* Trigger Flight Arrival & Dispatch Button */}
                  <button
                    onClick={handleSimulateArrivalAndDispatch}
                    disabled={isProcessing || selectedRequest.status === "EN_ROUTE"}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                      selectedRequest.status === "EN_ROUTE"
                        ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 cursor-default"
                        : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Tracking Flight &
                        Dispatching...
                      </>
                    ) : selectedRequest.status === "EN_ROUTE" ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Driverless Vehicle
                        Dispatched & En Route
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" /> Simulate Flight Arrival & Dispatch Driverless
                        Vehicle
                      </>
                    )}
                  </button>

                  {/* Autonomous Dispatch Confirmation Card */}
                  {selectedRequest.vehicleDispatch && (
                    <div className="p-4 bg-slate-950 rounded-xl border border-cyan-500/40 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                        <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                          <Car className="w-4 h-4" /> Autonomous Vehicle Assigned (
                          {selectedRequest.vehicleDispatch.provider})
                        </span>
                        <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                          ETA: {selectedRequest.vehicleDispatch.estimatedEtaMinutes} Mins
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 text-[10px]">Driverless Model</span>
                          <p className="font-bold text-white">
                            {selectedRequest.vehicleDispatch.vehicleModel}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px]">Pickup Point</span>
                          <p className="font-bold text-amber-400">
                            {selectedRequest.vehicleDispatch.pickupPoint}
                          </p>
                        </div>
                      </div>

                      {/* SMS Notification Log */}
                      {selectedRequest.notificationMessageSent && (
                        <div className="p-2.5 bg-slate-900 rounded border border-slate-800 text-xs flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-300 block text-[10px]">
                              Automated VIP SMS Alert Sent
                            </span>
                            <span className="text-slate-400 font-mono text-[11px]">
                              {selectedRequest.notificationMessageSent}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Escrow Billing Receipt */}
                      {selectedRequest.billingRecord && (
                        <div className="p-2.5 bg-slate-900 rounded border border-slate-800 text-xs flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <CreditCard className="w-3.5 h-3.5 text-emerald-400" /> Club Escrow
                            Billed
                          </span>
                          <span className="font-mono text-emerald-400 font-bold">
                            ${selectedRequest.billingRecord.amountUsd.toFixed(2)} USD (SETTLED)
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No VIP transport request selected.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VipTransportManagementDashboard;
