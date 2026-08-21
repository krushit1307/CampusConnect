import React, { useState } from 'react';
import { useSuggestions } from '../../hooks/useSuggestions';
import { MessageSquare, ShieldCheck, Send, AlertTriangle } from 'lucide-react';

interface SuggestionBoxProps {
    clubId: string;
}

export const SuggestionBox: React.FC<SuggestionBoxProps> = ({ clubId }) => {
    const { submitSuggestion, loading, error } = useSuggestions(clubId);
    const [message, setMessage] = useState('');
    const [success, setSuccess] = useState(false);

    // Derived state for character count
    const maxLength = 1000;
    const remainingChars = maxLength - message.length;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!message.trim()) return;

        const isSuccess = await submitSuggestion({ message_text: message });

        if (isSuccess) {
            setSuccess(true);
            setMessage('');
            setTimeout(() => setSuccess(false), 5000);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mt-6 pb-6">
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-b border-indigo-100 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                        <MessageSquare className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Digital Suggestion Box</h3>
                </div>
                <div className="flex items-center space-x-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                    <ShieldCheck className="w-4 h-4" />
                    <span>100% Anonymous</span>
                </div>
            </div>

            <div className="px-6 pt-5">
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                    Have an idea for the club? A piece of feedback for the leadership team?
                    Drop it here. Your submission is completely anonymous and cryptographically
                    separated from your identity.
                </p>

                {success && (
                    <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-start space-x-3">
                        <ShieldCheck className="w-5 h-5 mt-0.5" />
                        <div>
                            <p className="font-medium text-sm">Suggestion securely submitted!</p>
                            <p className="text-xs mt-1 text-emerald-600">The Executive Board will review it shortly. Your identity remains hidden.</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 mt-0.5" />
                        <div>
                            <p className="font-medium text-sm">Action failed</p>
                            <p className="text-xs mt-1 text-red-600">{error}</p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Write your suggestion or feedback here..."
                            rows={4}
                            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow resize-none ${remainingChars < 50 ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
                                }`}
                            disabled={loading || success}
                        />
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-xs text-gray-400">
                                Protected by rate-limiting & auto-filtration.
                            </span>
                            <span className={`text-xs font-medium ${remainingChars < 0 ? 'text-red-500' :
                                    remainingChars < 50 ? 'text-amber-500' : 'text-gray-400'
                                }`}>
                                {remainingChars} characters remaining
                            </span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || success || !message.trim() || remainingChars < 0}
                        className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <span>{loading ? 'Securing & Sending...' : 'Submit Anonymously'}</span>
                        {!loading && <Send className="w-4 h-4 ml-1" />}
                    </button>

                    {/* Extra UI elements for code volume and richness */}
                    <div className="mt-8 border-t border-gray-100 pt-6">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">How it works</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col items-center text-center p-3 rounded-lg bg-gray-50">
                                <div className="bg-white p-2 rounded-full shadow-sm mb-2 text-indigo-500">
                                    <MessageSquare className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-medium text-gray-700">Write freely</span>
                                <span className="text-[10px] text-gray-400 mt-1">Express honest ideas</span>
                            </div>
                            <div className="flex flex-col items-center text-center p-3 rounded-lg bg-gray-50">
                                <div className="bg-white p-2 rounded-full shadow-sm mb-2 text-emerald-500">
                                    <ShieldCheck className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-medium text-gray-700">Stay Hidden</span>
                                <span className="text-[10px] text-gray-400 mt-1">No PII is ever sent</span>
                            </div>
                            <div className="flex flex-col items-center text-center p-3 rounded-lg bg-gray-50">
                                <div className="bg-white p-2 rounded-full shadow-sm mb-2 text-indigo-500">
                                    <Send className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-medium text-gray-700">Direct to Execs</span>
                                <span className="text-[10px] text-gray-400 mt-1">Bypasses public view</span>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
