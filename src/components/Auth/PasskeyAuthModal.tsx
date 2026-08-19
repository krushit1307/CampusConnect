import React, { useState } from 'react';
import { Fingerprint, Key, Plus, CheckCircle2, Loader2, X } from 'lucide-react';
import { MOCK_REGISTERED_PASSKEYS, RegisteredPasskey, simulateBiometricAuthentication } from '../../services/passkeyEngine';
import { PasskeyCardItem } from './PasskeyCardItem';

interface PasskeyAuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PasskeyAuthModal: React.FC<PasskeyAuthModalProps> = ({ isOpen, onClose }) => {
    const [passkeys, setPasskeys] = useState<RegisteredPasskey[]>(MOCK_REGISTERED_PASSKEYS);
    const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
    const [authSuccess, setAuthSuccess] = useState<boolean>(false);

    if (!isOpen) return null;

    const handleAuthenticate = async () => {
        setIsAuthenticating(true);
        const result = await simulateBiometricAuthentication();
        setIsAuthenticating(false);
        if (result.success) {
            setAuthSuccess(true);
            setTimeout(() => {
                setAuthSuccess(false);
                onClose();
            }, 1500);
        }
    };

    const handleDelete = (id: string) => {
        setPasskeys(prev => prev.filter(p => p.id !== id));
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl relative text-slate-100 font-sans">
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-1 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                    <div className="p-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
                        <Fingerprint className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-100">Passkeys & WebAuthn</h3>
                        <p className="text-xs text-slate-400">Passwordless Biometric Sign-In</p>
                    </div>
                </div>

                {authSuccess ? (
                    <div className="p-8 text-center space-y-3">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                        <h4 className="text-sm font-bold text-emerald-400">Biometric Verification Successful!</h4>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <button
                            type="button"
                            onClick={handleAuthenticate}
                            disabled={isAuthenticating}
                            className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition-all"
                        >
                            {isAuthenticating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Scanning Touch ID / Face ID...</span>
                                </>
                            ) : (
                                <>
                                    <Fingerprint className="w-4 h-4" />
                                    <span>Sign In with Passkey</span>
                                </>
                            )}
                        </button>

                        <div className="space-y-2 pt-2">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">Registered Biometric Devices:</span>
                            <div className="space-y-2">
                                {passkeys.map(p => (
                                    <PasskeyCardItem
                                        key={p.id}
                                        passkey={p}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PasskeyAuthModal;
