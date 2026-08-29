'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';

interface ChatMessage {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    isSystemMessage?: boolean;
}

interface ChatWindowProps {
    channelId: string;
}

export default function ChatWindow({ channelId }: ChatWindowProps) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [rateLimitWarning, setRateLimitWarning] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Mock fetching initial messages
    useEffect(() => {
        // In production, subscribe to WebSocket channel here
        setMessages([
            { id: '1', user_id: 'system', content: 'Welcome to the chat!', created_at: new Date().toISOString(), isSystemMessage: true }
        ]);
    }, [channelId]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || !user || isSending) return;

        const messageText = inputValue.trim();
        setInputValue(''); // Clear input immediately for better UX
        setIsSending(true);

        try {
            const response = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    channelId,
                    message: messageText,
                }),
            });

            const data = await response.json();

            if (data.rateLimited) {
                // Silently dropped by server, show private system message to user
                setRateLimitWarning(data.systemMessage);

                // Auto-clear warning after the retry period
                setTimeout(() => {
                    setRateLimitWarning(null);
                }, data.retryAfterSeconds * 1000 + 500);
            } else if (data.success) {
                setMessages(prev => [...prev, data.message]);
            } else {
                throw new Error(data.error || 'Failed to send');
            }
        } catch (error) {
            console.error('Send error:', error);
            setInputValue(messageText); // Restore input on failure
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h3 className="font-bold text-gray-900 dark:text-white">Event Chat</h3>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.user_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] px-4 py-2 rounded-2xl ${msg.isSystemMessage
                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm text-center w-full'
                                    : msg.user_id === user?.id
                                        ? 'bg-blue-600 text-white rounded-br-none'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none'
                                }`}
                        >
                            {!msg.isSystemMessage && msg.user_id !== user?.id && (
                                <p className="text-xs font-semibold mb-1 opacity-75">User {msg.user_id.slice(0, 4)}</p>
                            )}
                            <p className="text-sm">{msg.content}</p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Rate Limit Warning */}
            {rateLimitWarning && (
                <div className="mx-4 mb-2 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg text-yellow-800 dark:text-yellow-200 text-sm text-center animate-pulse">
                    ⚠️ {rateLimitWarning}
                </div>
            )}

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex space-x-2">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type a message..."
                    disabled={isSending || !!rateLimitWarning}
                    className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={isSending || !inputValue.trim() || !!rateLimitWarning}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSending ? '...' : 'Send'}
                </button>
            </form>
        </div>
    );
}
