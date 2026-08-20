import React, { useState } from 'react';
import { Globe, Lock, ShieldCheck } from 'lucide-react';
import { MOCK_SOCIAL_PROVIDERS, SocialAuthProvider } from '../../services/socialAuthEngine';
import { SocialProviderCardTile } from './SocialProviderCardTile';

export const AuthSocialProviderGrid: React.FC = () => {
    const [providers, setProviders] = useState<SocialAuthProvider[]>(MOCK_SOCIAL_PROVIDERS);

    const handleToggleConnect = (id: string) => {
        setProviders(prev => prev.map(p => {
            if (p.id === id) {
                return {
                    ...p,
                    isConnected: !p.isConnected,
                    connectedEmail: !p.isConnected ? 'user@campusconnect.edu' : undefined
                };
            }
            return p;
        }));
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6 text-slate-100 font-sans p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3 shadow-2xl">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                    <Globe className="w-4 h-4" /> CampusConnect Single Sign-On (SSO)
                </div>
                <h1 className="text-xl font-black text-slate-100">Social Identity & OAuth2 Providers</h1>
                <p className="text-xs text-slate-400">Manage connected OAuth2 single sign-on accounts for instant 1-click authentication.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {providers.map(provider => (
                    <SocialProviderCardTile
                        key={provider.id}
                        provider={provider}
                        onToggleConnect={handleToggleConnect}
                    />
                ))}
            </div>
        </div>
    );
};

export default AuthSocialProviderGrid;
