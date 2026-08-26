// =============================================================================
// Hook: useLiveQnA
// Issue: #3547 - Build an 'Interactive Real-Time Q&A Profanity/Troll Filter'
// Description: Manages the WebSocket subscription for the live Q & A feed.
// Filters out shadowbanned messages from the public view, while ensuring 
// the current user still sees their own messages(even if shadowbanned).
// Integrates the client - side toxicity scorer for instant submit feedback.
    // =============================================================================

    import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import { analyzeClientToxicity, ToxicityResult } from '../../lib/moderation/toxicityScorer';

export interface QnAMessage {
    id: string;
    event_id: string;
    user_id: string;
    content: string;
    is_shadowbanned: boolean;
    toxicity_score: number;
    created_at: string;
    profiles?: { full_name: string; avatar_url: string | null };
}

interface UseLiveQnAReturn {
    messages: QnAMessage[];
    isLoading: boolean;
    error: string | null;
    clientToxicity: ToxicityResult;
    checkClientToxicity: (text: string) => void;
    sendMessage: (eventId: string, content: string) => Promise<boolean>;
}

export function useLiveQnA(eventId: string | null, currentUserId: string | null): UseLiveQnAReturn {
    const [messages, setMessages] = useState<QnAMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [clientToxicity, setClientToxicity] = useState<ToxicityResult>({ score: 0, isToxic: false, matchedWords: [] });

    const channelRef = useRef<RealtimeChannel | null>(null);

    // Fetch initial messages (RLS will filter out shadowbanned messages from others)
    const fetchMessages = useCallback(async () => {
        if (!eventId) return;
        setIsLoading(true);

        try {
            const { data, error: fetchError } = await supabase
                .from('qna_messages')
                .select('*, profiles(user_id, full_name, avatar_url)')
                .eq('event_id', eventId)
                .order('created_at', { ascending: true })
                .limit(100);

            if (fetchError) throw fetchError;
            setMessages((data as QnAMessage[]) || []);
        } catch (err: any) {
            console.error('[useLiveQnA] Fetch failed:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [eventId]);

    // Subscribe to Realtime for new messages
    useEffect(() => {
        if (!eventId) return;
        fetchMessages();

        const channel = supabase
            .channel(`qna-feed-${eventId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'qna_messages', filter: `event_id=eq.${eventId}` },
                (payload) => {
                    const newMsg = payload.new as QnAMessage;

                    // RLS should prevent shadowbanned messages from others from reaching here,
                    // but we add a client-side guard just in case.
                    if (newMsg.is_shadowbanned && newMsg.user_id !== currentUserId) {
                        return; // Do not add to public feed
                    }

                    setMessages(prev => [...prev, newMsg]);
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
    }, [eventId, currentUserId, fetchMessages]);

    const checkClientToxicity = (text: string) => {
        const result = analyzeClientToxicity(text);
        setClientToxicity(result);
    };

    const sendMessage = async (eventId: string, content: string): Promise<boolean> => {
        // Block submission if client-side scorer flags it as highly toxic
        if (clientToxicity.isToxic) {
            alert('Your message contains inappropriate language and cannot be submitted.');
            return false;
        }

        try {
            const { error: insertError } = await supabase
                .from('qna_messages')
                .insert({ event_id: eventId, content });

            if (insertError) throw insertError;

            // Optimistically add to local state so the user sees it immediately
            // (The server webhook will process toxicity and potentially shadowban it)
            return true;
        } catch (err: any) {
            console.error('[useLiveQnA] Send failed:', err);
            setError(err.message);
            return false;
        }
    };

    return {
        messages,
        isLoading,
        error,
        clientToxicity,
        checkClientToxicity,
        sendMessage
    };
}
