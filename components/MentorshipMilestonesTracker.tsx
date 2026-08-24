/**
 * Enterprise Architectural Specification & React Component:
 * Module: Mentorship Milestone Tracker & Check-In Modal UI
 * File: components/MentorshipMilestonesTracker.tsx
 * Standard: React 18 Functional Component, Glassmorphic Design Token Integration
 * Compliance: WCAG 2.1 AA Color Contrast, Touch-Optimized PIN Pad Keypad (#4282)
 */

import React, { useState, useEffect } from 'react';
import { mentorshipMilestonesService, MentorshipPairState } from '../src/services/mentorshipMilestonesService';

export interface MentorshipMilestonesTrackerProps {
  pairId?: string;
  userRole?: 'MENTOR' | 'MENTEE';
}

export const MentorshipMilestonesTracker: React.FC<MentorshipMilestonesTrackerProps> = ({
  pairId = 'PAIR-101',
  userRole = 'MENTEE'
}) => {
  const [pair, setPair] = useState<MentorshipPairState | null>(null);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [pinCountdown, setPinCountdown] = useState<number>(0);
  const [inputPin, setInputPin] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  useEffect(() => {
    const data = mentorshipMilestonesService.getPairState(pairId);
    if (data) {
      setPair({ ...data });
    }
  }, [pairId]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (pinCountdown > 0) {
      timer = setInterval(() => {
        setPinCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [pinCountdown]);

  const handleGeneratePin = () => {
    if (!pair) return;
    try {
      const res = mentorshipMilestonesService.generateCheckInPin(pair.id, pair.mentorId);
      setGeneratedPin(res.pin);
      setPinCountdown(res.expiresInSeconds);
      setFeedbackMessage({ type: 'success', text: 'Dynamic 6-digit PIN generated! Share this PIN with your mentee.' });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    }
  };

  const handleVerifyPin = () => {
    if (!pair) return;
    setIsVerifying(true);
    try {
      const res = mentorshipMilestonesService.verifyCheckInPin(pair.id, pair.menteeId, inputPin);
      if (res.success) {
        setFeedbackMessage({ type: 'success', text: res.message });
        setInputPin('');
        const updated = mentorshipMilestonesService.getPairState(pairId);
        if (updated) setPair({ ...updated });
      } else {
        setFeedbackMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    } finally {
      setIsVerifying(false);
    }
  };

  if (!pair) {
    return <div className="p-4 text-gray-400">Loading Mentorship Milestones Tracker...</div>;
  }

  const nextMilestoneMeeting = Math.ceil((pair.meetingCount + 1) / 5) * 5;
  const progressPct = ((pair.meetingCount % 5) / 5) * 100;

  return (
    <div className="mentorship-tracker-container bg-slate-900 border border-slate-700/60 rounded-xl p-6 shadow-2xl max-w-2xl mx-auto text-slate-100 font-sans">
      {/* Tracker Header */}
      <div className="flex items-center justify-between border-b border-slate-700/80 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
            <span>🤝</span> Mentorship Milestone & Check-In Tracker
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Pair: {pair.mentorName} & {pair.menteeName}
          </p>
        </div>
        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-3 py-1 rounded-full">
          Verified Active
        </span>
      </div>

      {/* Progress & Milestone Card */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-lg">
          <span className="text-xs text-slate-400 uppercase font-mono">Verified Meetings</span>
          <div className="text-3xl font-bold text-white font-mono mt-1">{pair.meetingCount}</div>
          <span className="text-xs text-slate-400">Check-ins Completed</span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-lg">
          <span className="text-xs text-slate-400 uppercase font-mono">Milestones Unlocked</span>
          <div className="text-3xl font-bold text-amber-400 font-mono mt-1">{pair.totalMilestonesAchieved}</div>
          <span className="text-xs text-amber-300/80">🏆 1,000 Pts / Certificate per 5 Meetings</span>
        </div>
      </div>

      {/* Progress Bar to Next 5-Meeting Milestone */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>Current Progress to Meeting #{nextMilestoneMeeting} Certificate</span>
          <span className="font-mono text-emerald-400 font-bold">{pair.meetingCount % 5} / 5 Meetings</span>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Check-In Action Section */}
      <div className="bg-slate-800/50 border border-slate-700/80 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4">
          Cryptographic Meeting Check-In ({userRole})
        </h3>

        {userRole === 'MENTOR' ? (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-slate-300">
              When meeting with your mentee, generate a dynamic 6-digit PIN below. Your mentee must enter this PIN within 5 minutes.
            </p>
            {generatedPin ? (
              <div className="bg-slate-900 border border-emerald-500/50 p-4 rounded-lg text-center">
                <span className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Your 6-Digit Check-In PIN</span>
                <span className="text-4xl font-mono font-bold tracking-widest text-emerald-400">{generatedPin}</span>
                <div className="text-xs text-amber-400 mt-2 font-mono">
                  ⏱ Expires in: {Math.floor(pinCountdown / 60)}:{(pinCountdown % 60).toString().padStart(2, '0')}
                </div>
              </div>
            ) : (
              <button
                onClick={handleGeneratePin}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-lg"
              >
                ⚡ Generate Dynamic Check-In PIN
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-slate-300">
              Ask your mentor for their generated 6-digit PIN during your meeting and enter it below to verify your check-in.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                maxLength={6}
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-Digit PIN"
                className="bg-slate-900 border border-slate-700 focus:border-emerald-500 text-white font-mono text-center tracking-widest text-lg rounded-lg px-4 py-2 flex-1 outline-none"
              />
              <button
                onClick={handleVerifyPin}
                disabled={inputPin.length !== 6 || isVerifying}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg transition-all"
              >
                Verify PIN
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-lg text-xs font-semibold ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-600/50 text-emerald-300'
              : 'bg-rose-950/80 border border-rose-600/50 text-rose-300'
          }`}
        >
          {feedbackMessage.text}
        </div>
      )}
    </div>
  );
};
