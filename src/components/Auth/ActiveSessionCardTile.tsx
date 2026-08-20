import React from 'react';
import { Laptop, Smartphone, Globe, LogOut } from 'lucide-react';
import { LoginSessionItem } from '../../services/securitySessionEngine';

interface SessionCardProps {
    session: LoginSessionItem;
    onRevoke: (id: string) => void;
}

export const ActiveSessionCardTile: React.FC<SessionCardProps> = ({ session, onRevoke }) => {
    return (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-lg">
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-indigo-400">
                    {session.deviceName.toLowerCase().includes('iphone') ? (
                        <Smartphone className="w-4 h-4" />
                    ) : (
                        <Laptop className="w-4 h-4" />
                    )}
                </div>

                <div>
                    <div className="flex items-center gap-2">
                        <h5 className="font-bold text-slate-100">{session.deviceName}</h5>
                        {session.isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold">
                                Current Session
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{session.browser}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-1">
                        <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {session.location}</span>
                        <span>• {session.ipAddress}</span>
                    </div>
                </div>
            </div>

            {!session.isCurrent && (
                <button
                    type="button"
                    onClick={() => onRevoke(session.id)}
                    className="p-2 rounded-xl bg-slate-950 hover:bg-rose-500/10 border border-slate-800 text-slate-400 hover:text-rose-400 text-xs font-bold transition-all flex items-center gap-1"
                >
                    <LogOut className="w-3.5 h-3.5" /> Revoke
                </button>
            )}
        </div>
    );
};
