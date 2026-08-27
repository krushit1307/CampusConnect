import React from 'react';
import { ShieldCheck, Copy, Check, Lock } from 'lucide-react';

interface RecoveryCodesViewProps {
    backupCodes: string[];
    onFinish: () => void;
}

export const BackupRecoveryCodesView: React.FC<RecoveryCodesViewProps> = ({ backupCodes, onFinish }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(backupCodes.join('\n'));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-amber-400">
                    <Lock className="w-3.5 h-3.5" /> Save Emergency Backup Codes
                </span>
                <p>If you lose access to your authenticator app, these 8-digit codes are the only way to recover your CampusConnect account.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-slate-200">
                {backupCodes.map((code, idx) => (
                    <div key={idx} className="p-1.5 bg-slate-900 rounded-lg text-center border border-slate-800/60">
                        {code}
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={handleCopy}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-all flex items-center justify-center gap-1.5"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied Codes!' : 'Copy Codes'}</span>
                </button>
                <button
                    type="button"
                    onClick={onFinish}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all shadow-lg shadow-indigo-500/20"
                >
                    Complete Setup
                </button>
            </div>
        </div>
    );
};
