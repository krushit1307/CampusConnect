'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';

interface ApologyFormProps {
    violationId: string;
    onSuccess: () => void;
}

export default function ApologyForm({ violationId, onSuccess }: ApologyFormProps) {
    const { user } = useAuth();
    const [text, setText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);

    const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    const isValidLength = wordCount >= 50;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !isValidLength) return;

        setIsSubmitting(true);
        setError(null);
        setFeedback(null);

        try {
            const response = await fetch('/api/moderation/apology/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    violationId,
                    text,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to submit apology');
            }

            if (data.isSincere) {
                setFeedback('Your apology has been accepted. Your account has been reinstated.');
                setTimeout(onSuccess, 2000);
            } else {
                setError(`Your apology was rejected. Feedback: ${data.feedback}. Please rewrite your apology to be more sincere, take responsibility, and avoid sarcasm.`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-2xl w-full border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Account Reinstatement Apology
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
                To regain access to your account, you must submit a written apology of at least 50 words.
                Our system will evaluate your submission for sincerity. Apologies that are sarcastic, evasive, or blame others will be rejected.
            </p>

            {error && (
                <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
                    <strong>Rejected:</strong> {error}
                </div>
            )}

            {feedback && (
                <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300">
                    <strong>Accepted:</strong> {feedback}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Your Apology
                    </label>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        required
                        rows={8}
                        className={`w-full p-4 border rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${!isValidLength && text.length > 0 ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                            }`}
                        placeholder="I am writing to sincerely apologize for..."
                    />
                    <div className="flex justify-between mt-2">
                        <span className={`text-sm ${isValidLength ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            Word count: {wordCount} / 50 minimum
                        </span>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || !isValidLength}
                    className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-xl shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Evaluating Apology...' : 'Submit for Review'}
                </button>
            </form>
        </div>
    );
}
