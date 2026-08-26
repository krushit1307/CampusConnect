import React, { useState } from "react";
import {
  ShieldAlert,
  Lock,
  Unlock,
  CheckCircle2,
  Send,
  Building2,
  UserCheck,
  Sparkles,
  Info,
  Clock,
} from "lucide-react";
import {
  CriticalAccommodationType,
  AccessibilityRequestPayload,
  CRITICAL_ACCOMMODATIONS,
  routeAccessibilityRequest,
  getOrganizerLockedUIState,
  fulfillAccessibilityRequest,
} from "@/lib/accessibilityRouting";
import { cn } from "@/lib/utils";

export interface AccessibilityRoutingProtocolWidgetProps {
  eventId?: string;
  eventTitle?: string;
  isStudentOrganizer?: boolean;
  isUniversityAdmin?: boolean;
  initialRequest?: AccessibilityRequestPayload | null;
  onRequestSubmitted?: (request: AccessibilityRequestPayload) => void;
  onFulfillRequest?: (request: AccessibilityRequestPayload) => void;
  className?: string;
}

export const MOCK_PENDING_REQUEST: AccessibilityRequestPayload = {
  id: "req-asl-9402",
  eventId: "evt-keynote-1",
  eventTitle: "Annual Campus AI & Robotics Symposium 2026",
  accommodationType: "asl_interpreter",
  status: "routed_to_disability_services",
  disabilityServicesTicketId: "DS-9402",
  createdAt: new Date().toISOString(),
};

export const AccessibilityRoutingProtocolWidget: React.FC<AccessibilityRoutingProtocolWidgetProps> = ({
  eventId = "evt-keynote-1",
  eventTitle = "Annual Campus AI & Robotics Symposium 2026",
  isStudentOrganizer = true,
  isUniversityAdmin = true,
  initialRequest = MOCK_PENDING_REQUEST,
  onRequestSubmitted,
  onFulfillRequest,
  className,
}) => {
  const [request, setRequest] = useState<AccessibilityRequestPayload | null>(initialRequest);
  const [selectedType, setSelectedType] = useState<CriticalAccommodationType>("asl_interpreter");
  const [adminNotesInput, setAdminNotesInput] = useState<string>(
    "Certified ASL Interpreter Sarah Jenkins assigned (RID Certified ADA Interpreter)."
  );
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const lockedUI = request ? getOrganizerLockedUIState(request) : null;

  const handleAttendeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newReq = routeAccessibilityRequest({
      eventId,
      eventTitle,
      accommodationType: selectedType,
    });

    setRequest(newReq);
    if (onRequestSubmitted) onRequestSubmitted(newReq);

    setActionNotice(
      `Accommodation requested! Bypassed student organizers and routed directly to Disability Services (Ticket #${newReq.disabilityServicesTicketId}).`
    );
    setTimeout(() => setActionNotice(null), 5000);
  };

  const handleAdminFulfill = () => {
    if (!request || !adminNotesInput.trim()) return;
    const fulfilledReq = fulfillAccessibilityRequest(request, adminNotesInput.trim());

    setRequest(fulfilledReq);
    if (onFulfillRequest) onFulfillRequest(fulfilledReq);

    setActionNotice("Disability Services ticket marked as Fulfilled & Confirmed!");
    setTimeout(() => setActionNotice(null), 5000);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-teal-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-teal-950">
            <Building2 className="w-5 h-5 text-teal-700" />
            <span>Real-Time "Accessibility Need" Routing Protocol — {eventTitle}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Bypasses student organizers and routes critical ADA requests (ASL, Braille, Transport) directly to University Disability Professionals.
          </p>
        </div>

        <span className="px-3 py-1 bg-black text-white font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
          <ShieldAlert className="w-3.5 h-3.5 text-teal-400" />
          <span>ADA Direct Routing</span>
        </span>
      </div>

      {/* Action Notice Banner */}
      {actionNotice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main Grid: Student Organizer Locked View & Admin Fulfillment Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Student Organizer Locked UI View (#4277) */}
        <div className="p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-4 bg-slate-50">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-teal-600" />
              Student Organizer View (Club President)
            </h4>
            <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded border border-teal-300">
              Read-Only Status
            </span>
          </div>

          {request && lockedUI ? (
            <div className="space-y-3">
              {/* Locked Banner Alert */}
              <div
                className={cn(
                  "p-4 border-2 border-black rounded-lg space-y-2 text-xs",
                  lockedUI.isLocked ? "bg-amber-100 text-amber-950" : "bg-emerald-100 text-emerald-950"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-xs flex items-center gap-1.5">
                    {lockedUI.isLocked ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4 text-emerald-600" />}
                    {lockedUI.bannerTitle}
                  </span>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-black text-white">
                    {lockedUI.ticketIdText}
                  </span>
                </div>
                <p className="font-sans text-xs leading-relaxed">{lockedUI.bannerMessage}</p>
              </div>

              {/* Status Breakdown */}
              <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold uppercase text-gray-600 text-[11px]">Requested Accommodation:</span>
                  <span className="font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {CRITICAL_ACCOMMODATIONS[request.accommodationType]?.label}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-bold uppercase text-gray-600 text-[11px]">Assigned Responsible Party:</span>
                  <span className="font-bold text-indigo-900">University Disability Services Office</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 font-sans">
              No critical accessibility requests flagged for this event yet.
            </div>
          )}
        </div>

        {/* University Disability Services Admin Control Panel */}
        <div className="p-5 bg-white space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              University Disability Services Admin Panel
            </h4>
            <span className="text-[11px] font-sans text-gray-500">Professional Fulfillment</span>
          </div>

          {/* Form to submit new request or fulfill existing request */}
          {!request ? (
            <form onSubmit={handleAttendeeSubmit} className="space-y-3">
              <label htmlFor="accom-select" className="text-xs font-bold uppercase block text-gray-700">
                Submit Critical Accessibility RSVP Request:
              </label>
              <select
                id="accom-select"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as CriticalAccommodationType)}
                className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-mono bg-slate-50"
              >
                {Object.entries(CRITICAL_ACCOMMODATIONS).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="w-full py-2.5 px-4 border-2 border-black bg-black text-white font-bold text-xs uppercase rounded-md hover:bg-gray-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4 text-teal-400" />
                Route to Disability Services
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-sans text-indigo-950 space-y-1">
                <span className="font-bold font-mono text-[11px]">Disability Services Admin Task:</span>
                <p className="text-[11px] leading-relaxed">
                  Review ticket #{request.disabilityServicesTicketId} and assign certified professional resources (e.g. certified ASL interpreter or Braille printer).
                </p>
              </div>

              <div>
                <label htmlFor="admin-notes" className="text-xs font-bold uppercase block mb-1">
                  Resolution / Fulfillment Notes *
                </label>
                <textarea
                  id="admin-notes"
                  rows={3}
                  value={adminNotesInput}
                  onChange={(e) => setAdminNotesInput(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                />
              </div>

              <button
                type="button"
                onClick={handleAdminFulfill}
                disabled={request.status === "fulfilled_by_admin"}
                className={cn(
                  "w-full py-2.5 px-4 border-2 border-black font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1.5",
                  request.status === "fulfilled_by_admin"
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                )}
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>
                  {request.status === "fulfilled_by_admin"
                    ? "Fulfillment Confirmed"
                    : "Confirm & Fulfill Accommodations"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
