// =============================================================================
// File: src/components/wellness/PeerListenerDashboard.tsx
// Issue: #4296 - Develop a 'Dynamic "Mental Health" Peer Support Matcher'
// Description: Certified Peer Listener dashboard for upperclassmen psychology majors
//              to accept queue matches, review active listening guidelines, and track shifts.
// =============================================================================

import React, { useState } from "react";
import {
  HeartHandshake,
  ShieldCheck,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Headphones,
  BookOpen,
  Power,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PeerListenerProfile } from "@/types/peerSupportMatcher";
import { getMockPeerListeners } from "@/services/peerSupportMatcherService";
import { PeerListenerTrainingModule } from "@/components/wellness/PeerListenerTrainingModule";

export const PeerListenerDashboard: React.FC = () => {
  const [profile, setProfile] = useState<PeerListenerProfile>(getMockPeerListeners()[0]);
  const [isShiftActive, setIsShiftActive] = useState<boolean>(profile.isAvailableOnline);
  const [showTraining, setShowTraining] = useState<boolean>(false);

  const pendingRequests = [
    {
      id: "req-01",
      topic: "Academic Burnout & Midterm Exam Panic",
      mood: 2,
      waitingSeconds: 34,
      tag: "High Priority",
    },
    {
      id: "req-02",
      topic: "Social Isolation & Roommate Dispute",
      mood: 3,
      waitingSeconds: 12,
      tag: "Normal",
    },
  ];

  return (
    <div className="neu-border bg-white p-6 dark:bg-zinc-900 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-purple-500 text-white">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase text-zinc-900 dark:text-white">
              Certified Peer Listener Command Portal
            </h3>
            <p className="font-mono text-xs text-zinc-500">
              Anonymous Student Support Operations • Alias: <strong>{profile.anonymousAlias}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowTraining((prev) => !prev)}
            className="neu-border flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold uppercase bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300 border-purple-400"
          >
            <GraduationCap className="h-3.5 w-3.5" />
            {showTraining ? "Hide Training" : "Training & Ethics"}
          </button>

          <button
            type="button"
            onClick={() => setIsShiftActive((prev) => !prev)}
            className={`neu-border flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${
              isShiftActive
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-500"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            {isShiftActive ? "Listening Shift: ACTIVE" : "Shift: OFFLINE"}
          </button>
        </div>
      </div>

      {showTraining && <PeerListenerTrainingModule />}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 font-mono text-xs">
        <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
          <span className="text-[10px] uppercase font-bold text-zinc-500">Certification</span>
          <p className="font-black text-zinc-900 dark:text-white mt-1">
            {profile.certificationLevel.replace(/_/g, " ")}
          </p>
        </div>

        <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
          <span className="text-[10px] uppercase font-bold text-zinc-500">Sessions Completed</span>
          <p className="font-black text-purple-600 dark:text-purple-400 mt-1">
            {profile.totalSessionsCompleted} Sessions
          </p>
        </div>

        <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
          <span className="text-[10px] uppercase font-bold text-zinc-500">Major / Specialization</span>
          <p className="font-bold text-zinc-800 dark:text-zinc-200 mt-1 truncate">
            {profile.majorOrFocus}
          </p>
        </div>

        <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
          <span className="text-[10px] uppercase font-bold text-zinc-500">Privacy Status</span>
          <p className="font-black text-emerald-600 mt-1">
            E2EE Zero-Log Enforced
          </p>
        </div>
      </div>

      {/* Pending Incoming Queue */}
      <div>
        <h4 className="font-mono text-xs font-black uppercase text-zinc-700 dark:text-zinc-300 mb-2">
          Incoming Anonymous Queue ({pendingRequests.length} Students Waiting)
        </h4>

        <div className="space-y-2">
          {pendingRequests.map((req) => (
            <div
              key={req.id}
              className="neu-border bg-zinc-50 p-3.5 font-mono text-xs dark:bg-zinc-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-900 dark:text-white">{req.topic}</span>
                  <span className="rounded bg-rose-100 text-rose-900 px-1.5 py-0.5 text-[9px] font-black uppercase dark:bg-rose-950 dark:text-rose-300">
                    {req.tag}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  Initial Mood: {req.mood}/5 • In Queue for {req.waitingSeconds}s • E2EE Handshake Ready
                </p>
              </div>

              <Button
                disabled={!isShiftActive}
                className="neu-border bg-purple-600 font-mono text-xs font-black uppercase text-white hover:bg-purple-700 shadow-[3px_3px_0_0_#000]"
              >
                <Headphones className="h-3.5 w-3.5 mr-1" />
                Accept & Connect E2EE Chat
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Active Listening Reminders */}
      <div className="neu-border bg-amber-50/70 p-4 font-mono text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-200 border-amber-300">
        <div className="flex items-center gap-1.5 font-bold mb-1">
          <BookOpen className="h-4 w-4 text-amber-600" />
          <span>Peer Listener Code of Conduct & Active Listening Rules:</span>
        </div>
        <ul className="list-disc list-inside text-[11px] space-y-1 text-zinc-700 dark:text-zinc-300 pl-2">
          <li>Listen empathetically without giving unsolicited life or medical advice.</li>
          <li>Validate emotions before attempting problem-solving.</li>
          <li>If an attendee mentions self-harm or immediate danger, click the 1-Click Crisis Escalation trigger.</li>
          <li>Never ask for real names, student IDs, dorm room numbers, or social media handles.</li>
        </ul>
      </div>
    </div>
  );
};

export default PeerListenerDashboard;
