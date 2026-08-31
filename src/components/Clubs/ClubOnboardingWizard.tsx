import React, { useState, useEffect } from 'react';
import { ClubOnboardingState, ExecutiveOfficer } from '@/types/clubOnboarding';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Upload,
  ShieldCheck,
  Users,
  FileText,
  Calendar,
  Layers,
  Check,
} from 'lucide-react';

interface ClubOnboardingWizardProps {
  clubSlug: string;
  onFinish: (state: ClubOnboardingState) => void;
}

export function ClubOnboardingWizard({ clubSlug, onFinish }: ClubOnboardingWizardProps) {
  const storageKey = `cc-onboarding-${clubSlug}`;

  const [state, setState] = useState<ClubOnboardingState>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback to default
      }
    }
    return {
      currentStep: 1,
      isCompleted: false,
      clubName: 'Undergraduate Artificial Intelligence Society',
      tagline: 'Empowering students through applied AI research & projects',
      category: 'Technology & Computing',
      primaryColor: '#84cc16',
      missionStatement: 'To foster collaborative machine learning research and connect students with industry engineers.',
      meetingSchedule: 'Wednesdays at 6:00 PM (Weekly in CS Hall 102)',
      executives: [
        { name: 'Alex Johnson', email: 'alex.j@university.edu', role: 'President' },
        { name: 'Maya Lin', email: 'maya.l@university.edu', role: 'Vice President' },
        { name: 'Marcus Thorne', email: 'marcus.t@university.edu', role: 'Treasurer' },
      ],
      constitutionUploaded: true,
      constitutionFileName: 'UAIS_Constitution_2026.pdf',
      firstEventDraft: {
        title: 'Fall General Body Meeting & AI Project Showcase',
        date: '2026-09-12',
        location: 'Student Union Grand Ballroom',
        description: 'Meet the executive board, enjoy free pizza, and join our semester hackathon teams!',
      },
    };
  });

  // Auto-save state to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  const steps = [
    { num: 1, title: 'Branding', icon: Sparkles },
    { num: 2, title: 'Mission', icon: FileText },
    { num: 3, title: 'Officers', icon: Users },
    { num: 4, title: 'Bylaws', icon: ShieldCheck },
    { num: 5, title: 'Kickoff', icon: Calendar },
  ];

  const handleNext = () => {
    if (state.currentStep < 5) {
      setState({ ...state, currentStep: state.currentStep + 1 });
    } else {
      const finished = { ...state, isCompleted: true };
      setState(finished);
      onFinish(finished);
    }
  };

  const handleBack = () => {
    if (state.currentStep > 1) {
      setState({ ...state, currentStep: state.currentStep - 1 });
    }
  };

  return (
    <div className="bg-white border-2 border-black rounded-lg shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden max-w-4xl mx-auto">
      {/* Top Stepper Bar */}
      <div className="bg-slate-50 border-b-2 border-black p-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isCurrent = state.currentStep === s.num;
            const isDone = state.currentStep > s.num || state.isCompleted;

            return (
              <React.Fragment key={s.num}>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-10 h-10 rounded-full border-2 border-black flex items-center justify-center font-display font-black text-sm transition-all ${
                      isDone
                        ? 'bg-lime text-black'
                        : isCurrent
                        ? 'bg-black text-white ring-4 ring-lime'
                        : 'bg-white text-gray-400'
                    }`}
                  >
                    {isDone ? <Check size={18} /> : <Icon size={18} />}
                  </div>
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      isCurrent ? 'text-black' : 'text-gray-500'
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 border-t-2 transition-colors ${
                      state.currentStep > s.num ? 'border-black' : 'border-gray-300'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Wizard Form Body */}
      <div className="p-8 min-h-[380px] flex flex-col justify-between">
        {/* Step 1: Branding & Identity */}
        {state.currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="font-display font-black text-2xl text-black">
              Step 1: Club Identity & Brand Colors
            </h3>
            <p className="font-mono text-xs text-gray-600">
              Establish your organization's official public name, tagline, and brand accent.
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">Official Club Name</label>
                <input
                  type="text"
                  value={state.clubName}
                  onChange={(e) => setState({ ...state, clubName: e.target.value })}
                  className="w-full p-2.5 border-2 border-black rounded bg-white font-bold"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">One-line Tagline</label>
                <input
                  type="text"
                  value={state.tagline}
                  onChange={(e) => setState({ ...state, tagline: e.target.value })}
                  className="w-full p-2.5 border-2 border-black rounded bg-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">Category</label>
                  <select
                    value={state.category}
                    onChange={(e) => setState({ ...state, category: e.target.value })}
                    className="w-full p-2.5 border-2 border-black rounded bg-white font-bold"
                  >
                    <option value="Technology & Computing">Technology & Computing</option>
                    <option value="Academic & Professional">Academic & Professional</option>
                    <option value="Arts & Creative">Arts & Creative</option>
                    <option value="Community & Cultural">Community & Cultural</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">Brand Accent Color</label>
                  <div className="flex items-center gap-2 mt-1">
                    {['#84cc16', '#3b82f6', '#ec4899', '#eab308', '#8b5cf6'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setState({ ...state, primaryColor: c })}
                        className={`w-7 h-7 rounded-full border-2 ${
                          state.primaryColor === c ? 'border-black scale-110 ring-2 ring-black' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Mission & Charter */}
        {state.currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="font-display font-black text-2xl text-black">
              Step 2: Mission Statement & Meeting Cadence
            </h3>
            <p className="font-mono text-xs text-gray-600">
              Help prospective members understand what your club stands for and when meetings occur.
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">Mission & Purpose</label>
                <textarea
                  rows={4}
                  value={state.missionStatement}
                  onChange={(e) => setState({ ...state, missionStatement: e.target.value })}
                  className="w-full p-2.5 border-2 border-black rounded bg-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">Weekly Meeting Schedule & Location</label>
                <input
                  type="text"
                  value={state.meetingSchedule}
                  onChange={(e) => setState({ ...state, meetingSchedule: e.target.value })}
                  className="w-full p-2.5 border-2 border-black rounded bg-white font-bold"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Executive Board */}
        {state.currentStep === 3 && (
          <div className="space-y-4">
            <h3 className="font-display font-black text-2xl text-black">
              Step 3: Executive Board Officers
            </h3>
            <p className="font-mono text-xs text-gray-600">
              Assign Student Union administrative roles for your leadership team.
            </p>

            <div className="space-y-2.5 font-mono text-xs">
              {state.executives.map((officer, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border-2 border-black rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-lime border border-black flex items-center justify-center font-bold">
                      {officer.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-black">{officer.name}</div>
                      <div className="text-gray-500 text-[11px]">{officer.email}</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 bg-black text-white rounded font-bold uppercase text-[10px]">
                    {officer.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Constitution Upload */}
        {state.currentStep === 4 && (
          <div className="space-y-4">
            <h3 className="font-display font-black text-2xl text-black">
              Step 4: Constitution & Bylaws
            </h3>
            <p className="font-mono text-xs text-gray-600">
              Upload your official Student Government approved constitution PDF.
            </p>

            <div className="p-8 border-2 border-dashed border-black rounded-lg bg-slate-50 text-center space-y-3">
              <div className="w-12 h-12 bg-lime border-2 border-black rounded-full flex items-center justify-center mx-auto">
                <FileText size={22} className="text-black" />
              </div>
              <div className="font-mono text-xs">
                <div className="font-bold text-black text-sm">{state.constitutionFileName}</div>
                <div className="text-emerald-700 font-bold mt-0.5">Verified Document Uploaded ✓</div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Draft First Event */}
        {state.currentStep === 5 && (
          <div className="space-y-4">
            <h3 className="font-display font-black text-2xl text-black">
              Step 5: Draft Your First Kickoff Event
            </h3>
            <p className="font-mono text-xs text-gray-600">
              Publish an inaugural welcome event so new students can RSVP immediately upon launch!
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">Event Title</label>
                <input
                  type="text"
                  value={state.firstEventDraft.title}
                  onChange={(e) =>
                    setState({
                      ...state,
                      firstEventDraft: { ...state.firstEventDraft, title: e.target.value },
                    })
                  }
                  className="w-full p-2.5 border-2 border-black rounded bg-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">Kickoff Date</label>
                  <input
                    type="date"
                    value={state.firstEventDraft.date}
                    onChange={(e) =>
                      setState({
                        ...state,
                        firstEventDraft: { ...state.firstEventDraft, date: e.target.value },
                      })
                    }
                    className="w-full p-2.5 border-2 border-black rounded bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={state.firstEventDraft.location}
                    onChange={(e) =>
                      setState({
                        ...state,
                        firstEventDraft: { ...state.firstEventDraft, location: e.target.value },
                      })
                    }
                    className="w-full p-2.5 border-2 border-black rounded bg-white font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Navigation Buttons */}
        <div className="pt-6 border-t-2 border-slate-100 flex items-center justify-between font-mono text-xs">
          <button
            type="button"
            disabled={state.currentStep === 1}
            onClick={handleBack}
            className="px-4 py-2.5 border-2 border-black rounded font-bold uppercase hover:bg-slate-100 disabled:opacity-30 flex items-center gap-1.5"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="neu-border bg-lime hover:bg-lime/90 px-6 py-2.5 font-black uppercase text-black flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-transform"
          >
            {state.currentStep === 5 ? 'Launch Club Dashboard' : 'Continue to Next Step'}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
