import React from 'react';
import { CheckCircle2, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { SocialAuthProvider } from '../../services/socialAuthEngine';

interface ProviderCardProps {
    provider: SocialAuthProvider;
    onToggleConnect: (id: string) => void;
}

export const SocialProviderCardTile: React.FC<ProviderCardProps> = ({ provider, onToggleConnect }) => {
    return (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-lg transition-all hover:border-slate-700">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 font-black font-mono text-indigo-400 flex items-center justify-center uppercase text-sm">
                    {provider.name.charAt(0)}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h5 className="font-bold text-slate-100">{provider.name}</h5>
                        {provider.badgeText && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[9px] font-bold">
                                {provider.badgeText}
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono">
                        {provider.isConnected ? provider.connectedEmail : 'Not Linked'}
                    </p>
                </div>
            </div>

            <button
                type="button"
                onClick={() => onToggleConnect(provider.id)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                    provider.isConnected
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                }`}
            >
                {provider.isConnected ? (
                    <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Linked</span>
                    </>
                ) : (
                    <>
                        <span>Connect</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                    </>
                )}
            </button>
        </div>
    );
};
