'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { getRecaptchaToken } from '@/lib/security/recaptcha';
import StepUpAuthModal from '@/components/events/StepUpAuthModal';
import { useAuth } from '@/lib/auth';

export default function EventRSVPPage() {
    const params = useParams();
    const eventId = params.id as string;
    const { user } = useAuth();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpSessionId, setOtpSessionId] = useState<string | null>(null);
    const [phoneNumber, setPhoneNumber] = useState('');

    const handleRSVP = async () => {
        if (!user) {
            setError('Please log in to RSVP.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 1. Generate reCAPTCHA token
            const token = await getRecaptchaToken('rsvp');

            // 2. Send to backend
            const response = await fetch(`/api/events/${eventId}/rsvp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    recaptchaToken: token,
                    phoneNumber: phoneNumber || user.user_metadata?.phone,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to RSVP');
            }

            if (data.requiresOtp) {
                setOtpSessionId(data.otpSessionId);
                setShowOtpModal(true);
            } else {
                alert('Successfully claimed your ticket!');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpVerify = async (otp: string): Promise<boolean> => {
        if (!otpSessionId) return false;

        const response = await fetch(`/api/events/${eventId}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ otpSessionId, otp }),
        });

        const data = await response.json();
        return data.success;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Claim Your Ticket
                </h1>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {!user?.user_metadata?.phone && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Phone Number (for verification)
                        </label>
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="+1 (555) 000-0000"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                )}

                <button
                    onClick={handleRSVP}
                    disabled={isLoading}
                    className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-xl shadow-md transition-all duration-200 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Processing...</span>
                        </>
                    ) : (
                        <span>Claim Ticket</span>
                    )}
                </button>
            </div>

            <StepUpAuthModal
                isOpen={showOtpModal}
                onClose={() => setShowOtpModal(false)}
                onVerify={handleOtpVerify}
                phoneNumber={phoneNumber || user?.user_metadata?.phone || ''}
            />
        </div>
    );
}
