import React, { useState } from 'react';
import { ShieldCheck, Lock, Activity, Key, LogOut } from 'lucide-react';
import { MOCK_LOGIN_SESSIONS, LoginSessionItem, calculateSecurityPostureScore } from '../../services/securitySessionEngine';
import { ActiveSessionCardTile } from './ActiveSessionCardTile';

export const AuthSecurityHub: React.FC = () => {
    const [sessions, setSessions] = useState<LoginSessionItem[]>(MOCK_LOGIN_SESSIONS);
    const [mfaEnabled] = useState<boolean>(true);
    const [passkeyRegistered] = useState<boolean>(true);

    const handleRevokeSession = (id: string) => {
        setSessions(prev => prev.filter(s => s.id !== id));
    };

    const handleRevokeAllOtherSessions = () => {
        setSessions(prev => prev.filter(s => s.isCurrent));
    };

    const postureScore = calculateSecurityPostureScore(mfaEnabled, passkeyRegistered, sessions.length);

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6 text-slate-100 font-sans p-4">
            {/* Header Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                            <ShieldCheck className="w-4 h-4" /> Account Protection
                        </div>
                        <h1 className="text-2xl font-black text-slate-100 mt-1">Security & Session Activity Hub</h1>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                        <Activity className="w-5 h-5 text-indigo-400" />
                        <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Security Posture</span>
                            <span className="text-lg font-black text-indigo-400 font-mono">{postureScore}% Excellent</span>
                        </div>
                    </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-3 text-xs">
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" /> 2FA Multi-Factor Auth Enabled
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 font-bold flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5" /> Passkey Biometrics Registered
                    </div>
                </div>
            </div>

            {/* Sessions List Section */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-200">Active Login Sessions ({sessions.length})</h3>
                    {sessions.length > 1 && (
                        <button
                            type="button"
                            onClick={handleRevokeAllOtherSessions}
                            className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                        >
                            <LogOut className="w-3.5 h-3.5" /> Revoke all other sessions
                        </button>
                    )}
                </div>

                <div className="space-y-3">
                    {sessions.map(session => (
                        <ActiveSessionCardTile
                            key={session.id}
                            session={session}
                            onRevoke={handleRevokeSession}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AuthSecurityHub;
