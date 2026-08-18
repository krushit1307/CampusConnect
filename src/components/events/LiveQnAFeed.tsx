// =============================================================================
// Component: LiveQnAFeed
//  Issue: #3547 - Build an 'Interactive Real-Time Q&A Profanity/Troll Filter'
//  Description: The public-facing live Q&A feed projected on stage screens.
//  Displays incoming messages in real-time, filtering out shadowbanned trolls.
//  Includes an input box with instant client-side toxicity warnings.
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useLiveQnA, QnAMessage } from '../../hooks/useLiveQnA';
import { supabase } from '../../../lib/supabaseClient';

interface LiveQnAFeedProps {
    eventId: string;
}

export const LiveQnAFeed: React.FC<LiveQnAFeedProps> = ({ eventId }) => {
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setCurrentUserId(data.user?.id || null);
        });
    }, []);

    const { messages, isLoading, error, clientToxicity, checkClientToxicity, sendMessage } = useLiveQnA(eventId, currentUserId);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setInputText(text);
        checkClientToxicity(text);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || clientToxicity.isToxic) return;

        const success = await sendMessage(eventId, inputText);
        if (success) {
            setInputText('');
            checkClientToxicity('');
        }
    };

    const getToxicityBorderColor = () => {
        if (clientToxicity.score >= 0.8) return 'border-red-500 focus:ring-red-500';
        if (clientToxicity.score >= 0.5) return 'border-amber-500 focus:ring-amber-500';
        return 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500';
    };

    return (
        <div className="flex flex-col h-[600px] bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
                <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                    Live Q&A Feed
                </h3>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {messages.length} Questions
                </span>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-50/50 dark:bg-gray-900/50">
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>)}
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <svg className="w-16 h-16 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="font-medium">No questions yet. Be the first to ask!</p>
                    </div>
                ) : (
                    messages.map(msg => (
                        <MessageBubble key={msg.id} message={msg} isOwnMessage={msg.user_id === currentUserId} />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-2">
                <div className="relative">
                    <textarea
                        value={inputText}
                        onChange={handleInputChange}
                        placeholder="Ask a question..."
                        rows={2}
                        maxLength={500}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white resize-none transition-colors ${getToxicityBorderColor()}`}
                    />
                    {clientToxicity.score > 0 && (
                        <div className={`absolute bottom-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full ${clientToxicity.isToxic ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400'
                            }`}>
                            Toxicity: {Math.round(clientToxicity.score * 100)}%
                        </div>
                    )}
                </div>

                {clientToxicity.isToxic && (
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Your message contains inappropriate language and cannot be submitted.
                    </p>
                )}

                <button
                    type="submit"
                    disabled={!inputText.trim() || clientToxicity.isToxic}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm shadow-sm transition-colors"
                >
                    Submit Question
                </button>
            </form>
        </div>
    );
};

const MessageBubble: React.FC<{ message: QnAMessage; isOwnMessage: boolean }> = ({ message, isOwnMessage }) => {
    // If the message is shadowbanned, only show a subtle indicator to the author
    const isShadowbanned = message.is_shadowbanned && isOwnMessage;

    return (
        <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${isShadowbanned
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 opacity-60'
                    : isOwnMessage
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-none'
                }`}>
                {!isOwnMessage && (
                    <p className="text-xs font-bold mb-1 text-indigo-600 dark:text-indigo-400">
                        {message.profiles?.full_name || 'Anonymous'}
                    </p>
                )}

                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

                {isShadowbanned && (
                    <p className="text-[10px] mt-1 text-red-600 dark:text-red-400 font-bold italic">
                        (Hidden from public feed due to policy violation)
                    </p>
                )}
            </div>
        </div>
    );
};
