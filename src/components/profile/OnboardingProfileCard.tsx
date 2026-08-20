import React, { useState } from 'react';
import { User, GraduationCap, Sparkles, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { OnboardingProfileData, calculateProfileCompleteness } from '../../services/onboardingProfileEngine';
import { CampusInterestTagSelector } from './CampusInterestTagSelector';

export const OnboardingProfileCard: React.FC = () => {
    const [step, setStep] = useState<number>(1);
    const [profile, setProfile] = useState<OnboardingProfileData>({
        fullName: 'Dipanshu Batra',
        major: 'Computer Science',
        graduationYear: 2027,
        bio: 'Passionate about building full-stack open-source software and real-time collaboration engines.',
        selectedInterests: ['Artificial Intelligence', 'Open Source', 'Web Development']
    });

    const completeness = calculateProfileCompleteness(profile);

    const handleToggleTag = (tag: string) => {
        setProfile(prev => {
            const exists = prev.selectedInterests.includes(tag);
            return {
                ...prev,
                selectedInterests: exists
                    ? prev.selectedInterests.filter(t => t !== tag)
                    : [...prev.selectedInterests, tag]
            };
        });
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6 text-slate-100 font-sans p-4">
            {/* Header Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                        <Sparkles className="w-4 h-4" /> CampusConnect Student Onboarding
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-400">{completeness}% Complete</span>
                </div>

                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                        style={{ width: `${completeness}%` }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-teal-400 transition-all duration-500"
                    />
                </div>
            </div>

            {/* Step Wizard Container */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
                {step === 1 && (
                    <div className="space-y-4">
                        <h3 className="text-base font-bold text-slate-100">Step 1: Academic Profile</h3>
                        <div className="space-y-3 text-xs">
                            <div className="space-y-1">
                                <label className="text-slate-400 font-medium block">Full Name</label>
                                <input
                                    type="text"
                                    value={profile.fullName}
                                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-slate-400 font-medium block">Declared Major</label>
                                <input
                                    type="text"
                                    value={profile.major}
                                    onChange={(e) => setProfile({ ...profile, major: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setStep(2)}
                            className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                        >
                            <span>Next: Interests & Bio</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        <h3 className="text-base font-bold text-slate-100">Step 2: Campus Interests & Bio</h3>

                        <CampusInterestTagSelector
                            selectedInterests={profile.selectedInterests}
                            onToggleTag={handleToggleTag}
                        />

                        <div className="space-y-1 text-xs">
                            <label className="text-slate-400 font-medium block">Short Bio</label>
                            <textarea
                                value={profile.bio}
                                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                                rows={3}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="py-3 px-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold flex items-center gap-1.5"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep(3)}
                                className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20"
                            >
                                Complete Profile Setup
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="p-6 text-center space-y-3">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                        <h3 className="text-lg font-bold text-emerald-400">Profile Setup Complete!</h3>
                        <p className="text-xs text-slate-400">Your student card is now active across all CampusConnect modules.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OnboardingProfileCard;
