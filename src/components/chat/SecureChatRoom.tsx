// =============================================================================
// Component: SecureChatRoom
//Issue: #2905 - Implement 'End-to-End Encryption' for Sensitive Club Direct Messages
//Description: The UI for a zero - knowledge secure channel.Displays warnings
//about new devices, disables the search feature(since ciphertext cannot be 
//searched via SQL), and renders decrypted messages locally.
// =============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useSecureChat, SecureMessage } from '../../hooks/useSecureChat';

interface SecureChatRoomProps {
    channelId: string;
    channelName: string;
    userPrivateKey: CryptoKey | null;
}

export const SecureChatRoom: React.FC<SecureChatRoomProps> = ({
    channelId,
    channelName,
    userPrivateKey
}) => {
    const { messages, isLoading, isDecrypting, error, sendMessage, hasKeys } = useSecureChat(channelId, userPrivateKey);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isSending) return;

        setIsSending(true);
        const success = await sendMessage(input);
        if (success) {
            setInput('');
        }
        setIsSending(false);
    };

    if (!userPrivateKey) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
                <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h3 className="text-xl font-bold text-red-800 dark:text-red-300 mb-2">
                    Missing Private Key
                </h3>
                <p className="text-red-600 dark:text-red-400 max-w-md">
                    This is a secure, end-to-end encrypted channel. Your private key is not present on this device,
                    so historical messages cannot be decrypted. Please import your key backup from your original device.
                </p>
                <button className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">
                    Import Key Backup
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-200px)] bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header with Security Badge */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {channelName}
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400 rounded-full">
                                E2EE
                            </span>
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Messages are encrypted. Only participants can read them. Search is disabled.
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-50/50 dark:bg-gray-900/50">
                {isLoading || isDecrypting ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
                            <svg className="animate-spin h-8 w-8" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm font-medium">Decrypting messages locally...</span>
                        </div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                        <svg className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="font-medium">No messages yet</p>
                        <p className="text-sm mt-1">Start the secure conversation.</p>
                    </div>
                ) : (
                    messages.map(msg => (
                        <MessageBubble key={msg.id} message={msg} />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={hasKeys ? "Type a secure message..." : "Cannot send: Missing keys"}
                        disabled={!hasKeys || isSending}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={!hasKeys || isSending || !input.trim()}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                    >
                        {isSending ? (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        )}
                        Encrypt & Send
                    </button>
                </div>
                {error && (
                    <p className="text-xs text-red-500 mt-2">{error}</p>
                )}
            </form>
        </div>
    );
};

/**
 * Individual Message Bubble Component
 */
const MessageBubble: React.FC<{ message: SecureMessage }> = ({ message }) => {
    // Determine if the message was sent by the current user (simplified check)
    // In a real app, compare message.sender_id with the current auth user ID
    const isOwnMessage = false; // Placeholder logic

    return (
        <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${isOwnMessage
                    ? 'bg-green-600 text-white rounded-br-none'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-none'
                }`}>
                {!isOwnMessage && (
                    <p className={`text-xs font-bold mb-1 ${isOwnMessage ? 'text-green-100' : 'text-indigo-600 dark:text-indigo-400'}`}>
                        {message.sender_profile?.full_name || 'Unknown'}
                    </p>
                )}

                {message.decryption_error ? (
                    <p className="text-sm italic text-red-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Decryption failed (Key mismatch)
                    </p>
                ) : message.is_decrypted ? (
                    <p className="text-sm whitespace-pre-wrap break-words">{message.plaintext}</p>
                ) : (
                    <p className="text-sm italic text-gray-400">Decrypting...</p>
                )}

                <p className={`text-[10px] mt-1 text-right ${isOwnMessage ? 'text-green-200' : 'text-gray-400 dark:text-gray-500'}`}>
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>
    );
};
