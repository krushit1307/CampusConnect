'use client';

import { useState } from 'react';

interface StepUpAuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onVerify: (otp: string) => Promise<boolean>;
    phoneNumber: string;
}

export default function StepUpAuthModal({ isOpen, onClose, onVerify, phoneNumber }: StepUpAuthModalProps) {
    const [otp, setOtp] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length !== 6) {
            setError('Please enter a valid 6-digit code.');
            return;
        }

        setIsVerifying(true);
        setError(null);

        try {
            const success = await onVerify(otp);
            if (success) {
                onClose();
            } else {
                setError('Invalid code. Please try again.');
                setOtp('');
            }
        } catch (err) {
            setError('Verification failed. Please try again.');
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-200 dark:border-gray-700">
                <div className="text-center mb-6">
                    <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Verify Your Identity
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mt-2">
                        To prevent automated bots, we need to verify you are human. We have sent a 6-digit code to:
                    </p>
                    <p className="font-semibold text-gray-900 dark:text-white mt-1">
                        {phoneNumber}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="w-full text-center text-3xl tracking-widest p-4 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                    />

                    <div className="flex space-x-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isVerifying}
                            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isVerifying || otp.length !== 6}
                            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-xl shadow-md transition-colors disabled:opacity-50"
                        >
                            {isVerifying ? 'Verifying...' : 'Verify & Claim Ticket'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
