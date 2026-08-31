import React, { useState } from "react";
import {
  Smartphone,
  Calendar,
  Trash2,
  Plus,
  CheckCircle2,
  Zap,
  Radio,
  Clock,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import {
  ItinerarySession,
  WalletPushSyncRequest,
  WalletPushSyncResult,
  syncItineraryToWalletPass,
} from "@/lib/walletAgendaPushSync";
import { cn } from "@/lib/utils";

export interface WalletAgendaPushSyncWidgetProps {
  userId?: string;
  serialNumber?: string;
  pushToken?: string;
  initialSessions?: ItinerarySession[];
  onPassSynced?: (result: WalletPushSyncResult) => void;
  className?: string;
}

export const DEFAULT_SESSIONS: ItinerarySession[] = [
  {
    sessionId: "sess-101",
    title: "Keynote: Next-Gen AI Infrastructure",
    room: "Main Auditorium Hall A",
    startTime: "09:30 AM",
  },
  {
    sessionId: "sess-102",
    title: "Workshop: Quantum Computing Sandbox",
    room: "Engineering Bldg Rm 302",
    startTime: "11:15 AM",
  },
  {
    sessionId: "sess-103",
    title: "Panel: Campus Entrepreneurship Ecosystem",
    room: "Student Union Ballroom B",
    startTime: "02:00 PM",
  },
];

export const WalletAgendaPushSyncWidget: React.FC<WalletAgendaPushSyncWidgetProps> = ({
  userId = "u-student-101",
  serialNumber = "pass_user101_evt2026",
  pushToken = "apns_token_abc123xyz789",
  initialSessions = DEFAULT_SESSIONS,
  onPassSynced,
  className,
}) => {
  const [sessions, setSessions] = useState<ItinerarySession[]>(initialSessions);
  const [recentSyncResult, setRecentSyncResult] = useState<WalletPushSyncResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleRemoveSession = (session: ItinerarySession) => {
    const updatedSessions = sessions.filter((s) => s.sessionId !== session.sessionId);
    setSessions(updatedSessions);

    const request: WalletPushSyncRequest = {
      userId,
      serialNumber,
      pushToken,
      session,
      action: "removed",
    };

    const result = syncItineraryToWalletPass(request);
    setRecentSyncResult(result);
    if (onPassSynced) onPassSynced(result);

    setNotice(
      `Removed "${session.title}". Silent APNs push dispatched to Apple Wallet pass (${serialNumber}).`
    );
    setTimeout(() => setNotice(null), 5000);
  };

  const handleAddSampleSession = () => {
    const newSession: ItinerarySession = {
      sessionId: `sess-${Date.now()}`,
      title: "Networking Fireside Chat & Mixer",
      room: "Innovation Lounge Floor 2",
      startTime: "04:30 PM",
    };

    setSessions([...sessions, newSession]);

    const request: WalletPushSyncRequest = {
      userId,
      serialNumber,
      pushToken,
      session: newSession,
      action: "added",
    };

    const result = syncItineraryToWalletPass(request);
    setRecentSyncResult(result);
    if (onPassSynced) onPassSynced(result);

    setNotice(
      `Added "${newSession.title}". Silent APNs push dispatched to Apple Wallet pass.`
    );
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-sky-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-sky-950">
            <Smartphone className="w-5 h-5 text-sky-700 animate-bounce" />
            <span>Interactive "Event Schedule" Custom Agenda Push Sync</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Bi-directional APNs push synchronization for Apple Wallet & Google Wallet passes. Automatically re-renders digital passes on itinerary updates.
          </p>
        </div>

        <span className="px-3 py-1 bg-black text-white font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
          <Zap className="w-3.5 h-3.5 text-sky-300" />
          <span>APNs Sync Active</span>
        </span>
      </div>

      {/* Confirmation Notification Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Grid: Custom Agenda List & APNs Sync Log */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left Column: Custom Agenda Session List */}
        <div className="p-5 border-b-2 md:border-b-0 md:border-r-2 border-black space-y-4 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-sky-600" />
              Your Custom Event Itinerary
            </h4>
            <button
              type="button"
              onClick={handleAddSampleSession}
              className="px-2.5 py-1 bg-sky-600 text-white font-bold text-[10px] uppercase rounded border border-black hover:bg-sky-700 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Add Session</span>
            </button>
          </div>

          {/* Session Cards List */}
          <div className="space-y-2">
            {sessions.map((sess) => (
              <div
                key={sess.sessionId}
                className="p-3 border-2 border-black rounded-lg bg-slate-50 flex items-center justify-between gap-3 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <div className="space-y-0.5">
                  <span className="font-bold text-gray-900 block">{sess.title}</span>
                  <div className="flex items-center gap-2 text-[10px] text-gray-600 font-sans">
                    <span className="font-bold text-sky-900 font-mono">{sess.startTime}</span>
                    <span>•</span>
                    <span>{sess.room}</span>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label={`Remove ${sess.title}`}
                  onClick={() => handleRemoveSession(sess)}
                  className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 border border-black rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="p-6 text-center text-xs font-mono text-gray-500 bg-slate-50 border-2 border-black border-dashed rounded-lg">
                No sessions in itinerary. Click "Add Session" above to test APNs push sync.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: APNs Silent Push Sync Log */}
        <div className="p-5 bg-slate-50 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Radio className="w-4 h-4 text-sky-600" />
            Apple Wallet APNs Push Sync Audit Log
          </h4>

          <div className="p-3 border-2 border-black rounded-lg bg-white space-y-2 text-xs font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center text-[10px] text-gray-500 border-b border-gray-200 pb-1">
              <span className="font-bold text-sky-900">SERIAL: {serialNumber}</span>
              <span className="text-emerald-600 font-bold">LINKED</span>
            </div>
            <p className="text-[11px] text-gray-700 font-sans">
              APNs Push Token: <span className="font-mono text-black font-bold">{pushToken}</span>
            </p>
          </div>

          {/* APNs Payload Result Card */}
          {recentSyncResult ? (
            <div className="p-3.5 border-2 border-black rounded-lg bg-slate-900 text-white space-y-2 font-mono text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center text-[10px] text-sky-400 font-bold border-b border-slate-700 pb-1.5">
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5" /> SILENT APNS PUSH PAYLOAD
                </span>
                <span className="uppercase text-emerald-400 font-bold">ACTION: {recentSyncResult.action}</span>
              </div>

              <div className="space-y-1 text-[11px] font-mono text-gray-300">
                <pre className="p-2 bg-slate-950 rounded text-[10px] text-sky-300 overflow-x-auto">
                  {JSON.stringify(recentSyncResult.apnsPayload, null, 2)}
                </pre>
                <p className="text-[10px] text-emerald-400 font-bold pt-1">
                  ⚡ Silent push received by iPhone • Wallet pass re-fetched & re-rendered instantly.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs font-mono text-gray-500 bg-white border-2 border-black border-dashed rounded-lg">
              No APNs push dispatched yet. Add or remove a session on the left to trigger wallet sync.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
