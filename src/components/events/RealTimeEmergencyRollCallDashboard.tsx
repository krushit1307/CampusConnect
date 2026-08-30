import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  ShieldCheck,
  PhoneCall,
  Navigation,
  Radio,
  CheckCircle2,
  RefreshCw,
  Zap,
  Crosshair,
  Send,
  HelpCircle,
  Flame,
  CloudLightning,
  ShieldAlert,
  UserCheck,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AttendeeSafetyStatus,
  EmergencyRollCallAttendeeResponse,
  EmergencyRollCallCheck,
  EmergencyType,
} from "@/types/campusSafetyEmergencyRollCall";
import { campusSafetyEmergencyRollCallService } from "@/services/campusSafetyEmergencyRollCallService";

interface RealTimeEmergencyRollCallDashboardProps {
  eventId?: string;
  eventTitle?: string;
  campusLocation?: string;
}

export function RealTimeEmergencyRollCallDashboard({
  eventId = "evt-mountain-hike",
  eventTitle = "Annual Mountain Camping & Hiking Trip",
  campusLocation = "North Wilderness Ridge Basecamp",
}: RealTimeEmergencyRollCallDashboardProps) {
  const [activeCheck, setActiveCheck] = useState<EmergencyRollCallCheck | null>(null);
  const [responses, setResponses] = useState<EmergencyRollCallAttendeeResponse[]>([]);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "SAFE" | "NEED_ASSISTANCE" | "OVERDUE">(
    "ALL",
  );
  const [selectedEmergencyType, setSelectedEmergencyType] =
    useState<EmergencyType>("SEVERE_WEATHER");
  const [assistanceInput, setAssistanceInput] = useState<string>("");
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [nowTime, setNowTime] = useState<number>(Date.now());

  useEffect(() => {
    loadActiveCheck();
    const interval = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [eventId]);

  const loadActiveCheck = () => {
    const check = campusSafetyEmergencyRollCallService.getActiveCheck(eventId);
    if (check) {
      setActiveCheck(check);
      const res = campusSafetyEmergencyRollCallService.getResponsesForCheck(check.id);
      setResponses([...res]);
      campusSafetyEmergencyRollCallService.evaluateRollCallMetrics(check.id);
    } else {
      setActiveCheck(null);
      setResponses([]);
    }
  };

  const handleInitiateCheck = (type: EmergencyType = selectedEmergencyType) => {
    const check = campusSafetyEmergencyRollCallService.initiateEmergencyRollCall({
      eventId,
      eventTitle,
      campusLocation,
      emergencyType: type,
      durationMinutes: 15,
      initiatedByName: "Officer James Miller (Dispatch)",
    });
    setActiveCheck(check);
    const res = campusSafetyEmergencyRollCallService.getResponsesForCheck(check.id);
    setResponses([...res]);
    setActionNotice(
      `🚨 EMERGENCY ROLL CALL BROADCAST: Push & SMS alert dispatched to all ${check.totalAttendeesCount} attendees!`,
    );
  };

  const handleStudentSelfCheck = (status: "SAFE" | "NEED_ASSISTANCE") => {
    if (!activeCheck) return;

    // Simulate self check for current student (Maya Lin usr-stu-1 or Brandon Vance usr-stu-2)
    const currentUserId = "usr-stu-4"; // Derek O'Connor (pending/overdue)
    campusSafetyEmergencyRollCallService.submitAttendeeStatus({
      rollCallCheckId: activeCheck.id,
      userId: currentUserId,
      status,
      assistanceDetails: status === "NEED_ASSISTANCE" ? assistanceInput || "Requesting check-in" : undefined,
      latitude: 40.7185,
      longitude: -74.0082,
    });

    loadActiveCheck();
    setActionNotice(
      status === "SAFE"
        ? "✅ Safety confirmed! Your check-in was logged."
        : "⚠️ Emergency assistance request dispatched to Campus Safety!",
    );
  };

  const handleDispatchDrone = (userId: string, studentName: string) => {
    if (!activeCheck) return;
    campusSafetyEmergencyRollCallService.dispatchDroneToAttendee(activeCheck.id, userId);
    loadActiveCheck();
    setActionNotice(`🛸 Search drone dispatched to last known GPS coordinates of ${studentName}.`);
  };

  const handleResolveCheck = () => {
    if (!activeCheck) return;
    campusSafetyEmergencyRollCallService.resolveEmergencyRollCall(activeCheck.id);
    loadActiveCheck();
    setActionNotice("Emergency Roll Call marked RESOLVED. All attendees accounted for.");
  };

  const stats = activeCheck
    ? campusSafetyEmergencyRollCallService.evaluateRollCallMetrics(activeCheck.id)
    : null;

  const filteredResponses = responses.filter((r) => {
    if (activeFilter === "SAFE") return r.status === "SAFE";
    if (activeFilter === "NEED_ASSISTANCE") return r.status === "NEED_ASSISTANCE";
    if (activeFilter === "OVERDUE") return r.status === "OVERDUE" || r.status === "PENDING";
    return true;
  });

  const getEmergencyTypeBadge = (type: EmergencyType) => {
    switch (type) {
      case "FIRE_EVACUATION":
        return <Badge className="bg-orange-600 text-white font-mono uppercase">Fire Evacuation</Badge>;
      case "ACTIVE_THREAT":
        return <Badge className="bg-red-600 text-white font-mono uppercase">Active Threat</Badge>;
      case "SEVERE_WEATHER":
        return <Badge className="bg-blue-600 text-white font-mono uppercase">Severe Weather</Badge>;
      default:
        return <Badge className="bg-purple-600 text-white font-mono uppercase">Safety Drill</Badge>;
    }
  };

  const getStatusBadge = (status: AttendeeSafetyStatus) => {
    switch (status) {
      case "SAFE":
        return <Badge className="bg-emerald-600 text-white font-mono uppercase">Safe</Badge>;
      case "NEED_ASSISTANCE":
        return <Badge className="bg-amber-600 text-white font-mono uppercase">Assistance Needed</Badge>;
      case "OVERDUE":
        return <Badge className="bg-red-600 text-white font-mono uppercase">Overdue / Missing</Badge>;
      default:
        return <Badge className="bg-slate-700 text-slate-300 font-mono uppercase">Pending</Badge>;
    }
  };

  const getTimeRemainingStr = () => {
    if (!activeCheck) return "00:00";
    const expiresMs = new Date(activeCheck.expiresAt).getTime();
    const diff = Math.max(0, Math.floor((expiresMs - nowTime) / 1000));
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      data-testid="emergency-roll-call-dashboard"
      className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 border border-red-900/40 text-slate-100 shadow-2xl space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-red-900/50 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <Radio className="w-7 h-7 text-red-500 animate-pulse" />
            <h2 className="text-xl md:text-2xl font-bold font-display tracking-tight text-white">
              Real-Time Campus Safety Emergency Roll Call
            </h2>
            {activeCheck && getEmergencyTypeBadge(activeCheck.emergencyType)}
          </div>
          <p className="text-xs md:text-sm text-slate-400 font-mono mt-1">
            Broadcast safety check-ins & real-time attendee tracking for:{" "}
            <span className="text-red-300 font-semibold">{eventTitle}</span> ({campusLocation})
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeCheck ? (
            <Button
              size="sm"
              onClick={handleResolveCheck}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs uppercase px-4 py-2 font-bold shadow-lg"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Resolve Incident
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => handleInitiateCheck("SEVERE_WEATHER")}
              className="bg-red-600 hover:bg-red-700 text-white font-mono text-xs uppercase px-4 py-2 font-bold shadow-lg"
              data-testid="initiate-roll-call-btn"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Initiate Roll Call Check
            </Button>
          )}
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-700/60 flex items-center justify-between text-xs font-mono text-red-200 animate-fade-in">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">
            ×
          </button>
        </div>
      )}

      {/* Incident Initiation Bar (If no active check) */}
      {!activeCheck && (
        <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h4 className="text-sm font-semibold text-slate-200 font-mono uppercase tracking-wide">
            Select Incident Type & Broadcast Roll Call
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { type: "SEVERE_WEATHER", label: "Severe Weather", icon: CloudLightning },
              { type: "FIRE_EVACUATION", label: "Fire Evacuation", icon: Flame },
              { type: "ACTIVE_THREAT", label: "Active Threat", icon: ShieldAlert },
              { type: "OFF_CAMPUS_TRIP_CHECK", label: "Off-Campus Drill", icon: Navigation },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  onClick={() => {
                    setSelectedEmergencyType(item.type as EmergencyType);
                    handleInitiateCheck(item.type as EmergencyType);
                  }}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-red-500/60 text-left space-y-2 group transition"
                >
                  <Icon className="w-6 h-6 text-red-400 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-xs text-slate-200 block font-mono">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Roll Call Progress & Countdown */}
      {activeCheck && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-xs font-mono uppercase text-slate-400">Total Registered</span>
              <div className="text-2xl font-extrabold text-white mt-1 font-mono">
                {stats.totalCount}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block font-mono">
                Safe: <span className="text-emerald-400 font-bold">{stats.safeCount}</span> (
                {stats.safePercentage}%)
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-xs font-mono uppercase text-slate-400">Needs Assistance</span>
              <div className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">
                {stats.assistanceNeededCount}
              </div>
              <span className="text-[11px] text-amber-300/80 mt-1 block">Urgent priority</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-xs font-mono uppercase text-slate-400">Overdue / Unresponsive</span>
              <div className="text-2xl font-extrabold text-red-400 mt-1 font-mono">
                {stats.overdueCount}
              </div>
              <span className="text-[11px] text-red-300/80 mt-1 block">Failed to check in</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-xs font-mono uppercase text-slate-400">Timer Countdown</span>
              <div className="text-2xl font-extrabold text-indigo-400 mt-1 font-mono flex items-center gap-1.5">
                <Clock className="w-5 h-5 text-indigo-400" />
                {getTimeRemainingStr()}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block font-mono">15m Window</span>
            </div>
          </div>

          {/* Student Self Check-In Quick Bar */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono font-bold text-slate-200 uppercase">
                Student Self Check-In Panel
              </span>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Are you safe at {campusLocation}?
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => handleStudentSelfCheck("SAFE")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs uppercase px-4 py-2 font-bold shadow-lg"
                data-testid="student-check-safe-btn"
              >
                <ShieldCheck className="w-4 h-4 mr-1.5" /> I Am Safe
              </Button>

              <Button
                size="sm"
                onClick={() => handleStudentSelfCheck("NEED_ASSISTANCE")}
                className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-xs uppercase px-4 py-2 font-bold shadow-lg"
              >
                <HelpCircle className="w-4 h-4 mr-1.5" /> Request Assistance
              </Button>
            </div>
          </div>

          {/* Filter Navigation */}
          <div className="flex border-b border-slate-800 text-xs font-mono">
            {[
              { id: "ALL", label: `All Attendees (${responses.length})` },
              { id: "SAFE", label: `Safe (${stats.safeCount})` },
              { id: "NEED_ASSISTANCE", label: `Needs Assistance (${stats.assistanceNeededCount})` },
              { id: "OVERDUE", label: `Overdue / Missing (${stats.overdueCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-4 py-2 border-b-2 font-semibold transition ${
                  activeFilter === tab.id
                    ? "border-red-500 text-red-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Roster Stream */}
          <div className="space-y-3" data-testid="roll-call-roster">
            {filteredResponses.map((r) => (
              <div
                key={r.id}
                className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                  r.status === "SAFE"
                    ? "bg-slate-900/60 border-slate-800"
                    : r.status === "NEED_ASSISTANCE"
                    ? "bg-amber-950/40 border-amber-800/60"
                    : "bg-red-950/40 border-red-800/60"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-base">{r.studentName}</span>
                    <span className="text-xs text-slate-400 font-mono">({r.studentEmail})</span>
                    {getStatusBadge(r.status)}
                    {r.droneDispatched && (
                      <Badge className="bg-indigo-600 text-white font-mono text-[10px] uppercase">
                        Drone Dispatched
                      </Badge>
                    )}
                  </div>

                  {r.assistanceDetails && (
                    <p className="text-xs text-amber-200 font-mono bg-amber-950/60 p-2 rounded border border-amber-800/50">
                      Details: "{r.assistanceDetails}"
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs font-mono text-slate-400 pt-1">
                    {r.respondedAt ? (
                      <span>Checked in: {new Date(r.respondedAt).toLocaleTimeString()}</span>
                    ) : (
                      <span className="text-red-400 font-semibold">Unresponsive</span>
                    )}
                    {r.latitude && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <Navigation className="w-3 h-3 text-indigo-400" /> GPS: {r.latitude.toFixed(3)}, {r.longitude?.toFixed(3)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-2 font-mono text-xs">
                  {r.emergencyContactPhone && (
                    <a
                      href={`tel:${r.emergencyContactPhone}`}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{r.emergencyContactName}: {r.emergencyContactPhone}</span>
                    </a>
                  )}

                  {(r.status === "NEED_ASSISTANCE" || r.status === "OVERDUE") && !r.droneDispatched && (
                    <Button
                      size="sm"
                      onClick={() => handleDispatchDrone(r.userId, r.studentName)}
                      className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[11px] font-bold uppercase"
                    >
                      <Crosshair className="w-3.5 h-3.5 mr-1" /> Dispatch Search Drone
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
