import React from 'react';
import { Fingerprint, Key, Trash2 } from 'lucide-react';
import { RegisteredPasskey } from '../../services/passkeyEngine';

interface PasskeyItemProps {
    passkey: RegisteredPasskey;
    onDelete: (id: string) => void;
}

export const PasskeyCardItem: React.FC<PasskeyItemProps> = ({ passkey, onDelete }) => {
    return (
        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                    <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                    <h5 className="font-bold text-slate-100">{passkey.deviceName}</h5>
                    <p className="text-[10px] text-slate-500 font-mono">Last used: {passkey.lastUsedDate}</p>
                </div>
            </div>

            <button
                type="button"
                onClick={() => onDelete(passkey.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};
