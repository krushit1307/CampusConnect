// =============================================================================
// Component: RequestMentorshipModal
--Issue: #2963 - Build an 'Alumni Mentorship' Matching Module
--Description: Modal for students to send an introductory message to an
--alumni mentor.Enforces character limits and handles submission state.
// =============================================================================

import React, { useState } from 'react';
import { MentorProfile } from '../../hooks/useMentorshipDirectory';
import { supabase } from '../../../lib/supabaseClient';

interface RequestMentorshipModalProps {
    mentor: MentorProfile;
    onClose: () => void;
}

export const RequestMentorshipModal: React.FC<RequestMentorshipModalProps> = ({ mentor, onClose }) => {
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim().length < 50) {
            setError('Please write a slightly longer introduction (at least 50 characters).');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const { error: insertError } = await supabase
                .from('mentorship_requests')
                .insert({
                    mentor_id: mentor.user_id,
                    message: message.trim(),
                    status: 'pending'
                });

            if (insertError) {
                if (insertError.code === '23505') { // Unique violation
                    throw new Error('You have already sent a request to this mentor.');
                }
                throw insertError;
            }

            setSuccess(true);
            setTimeout(onClose, 2000); // Auto-close after success
        } catch (err: any) {
            setError(err.message || 'Failed to send request. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center border border-gray-200 dark:border-gray-700">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Request Sent!</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                        {mentor.profiles?.full_name} will review your request and get back to you soon.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
                    {mentor.profiles?.avatar_url ? (
                        <img src={mentor.profiles.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-lg">
                            {mentor.profiles?.full_name?.charAt(0) || 'A'}
                        </div>
                    )}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            Request Mentorship
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {mentor.profiles?.full_name} • {mentor.company}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Introduction Message <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={6}
                            maxLength={1000}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                            placeholder="Introduce yourself, your major, your career goals, and why you'd like to connect with this specific mentor..."
                            required
                        />
                        <div className="flex justify-between mt-1">
                            <p className={`text-xs ${message.length < 50 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                {message.length < 50 ? `Minimum 50 characters required (${50 - message.length} more)` : 'Looks good!'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {message.length}/1000
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || message.trim().length < 50}
                            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-2 shadow-md"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending...
                                </>
                            ) : (
                                'Send Request'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
