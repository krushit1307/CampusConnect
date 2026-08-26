// =============================================================================
// Hook: useChatTranslation
// Issue: #3699 - Implement 'Real-Time "Translation" for Live Chat'
// Description: Subscribes to an event's live chat, enriches incoming messages
// with translation metadata, and exposes a per-viewer "show original" toggle.
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
    TranslatedChatMessage, getViewerLanguage, chooseDisplayText, wasTranslated,
} from '../../lib/chat/translation';

interface UseChatTranslationReturn {
    messages: TranslatedChatMessage[];
    viewerLang: string;
    showOriginal: boolean;
    setShowOriginal: (v: boolean) => void;
    displayFor: (msg: TranslatedChatMessage) => string;
    isTranslated: (msg: TranslatedChatMessage) => boolean;
    sendMessage: (content: string) => Promise<void>;
}

export function useChatTranslation(eventId: string | null): UseChatTranslationReturn {
    const [messages, setMessages] = useState<TranslatedChatMessage[]>([]);
    const [showOriginal, setShowOriginal] = useState(false);
    const viewerLang = useMemo(() => getViewerLanguage(), []);
    const channelRef = React.useRef<RealtimeChannel | null>(null);

    // Load existing messages (already enriched by the translate-chat function)
    useEffect(() => {
        if (!eventId) return;
        const load = async () => {
            const { data } = await supabase
                .from('event_chat_messages')
                .select('id, content, source_lang, translated_en, created_at, profiles:sender_id(full_name)')
                .eq('event_id', eventId)
                .order('created_at', { ascending: true })
                .limit(100);
            setMessages(((data as any[]) || []).map(m => ({
                id: m.id,
                content: m.content,
                source_lang: m.source_lang,
                translated_en: m.translated_en,
                sender_name: m.profiles?.full_name || 'Anonymous',
                created_at: m.created_at,
            })));
        };
        load();
    }, [eventId]);

    // Realtime subscription for new messages
    useEffect(() => {
        if (!eventId) return;
        const channel = supabase
            .channel(`chat-translate-${eventId}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'event_chat_messages', filter: `event_id=eq.${eventId}`,
            }, async (payload) => {
                const row = payload.new as any;
                // Enrich via the Edge Function if translation metadata is missing
                let enriched = row;
                if (!row.translated_en) {
                    try {
                        const { data } = await supabase.functions.invoke('translate-chat', {
                            body: { message_id: row.id, content: row.content },
                        });
                        enriched = { ...row, source_lang: data?.source_lang, translated_en: data?.translated_en };
                    } catch { /* fall back to raw row */ }
                }
                setMessages(prev => [...prev, {
                    id: enriched.id,
                    content: enriched.content,
                    source_lang: enriched.source_lang,
                    translated_en: enriched.translated_en,
                    sender_name: 'You',
                    created_at: enriched.created_at,
                }]);
            })
            .subscribe();

        channelRef.current = channel;
        return () => { supabase.removeChannel(channel); };
    }, [eventId]);

    const sendMessage = useCallback(async (content: string) => {
        if (!eventId || !content.trim()) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from('event_chat_messages').insert({ event_id: eventId, sender_id: user.id, content });
    }, [eventId]);

    // Decide what to render for a message honoring the show-original toggle
    const displayFor = useCallback((msg: TranslatedChatMessage) => {
        if (showOriginal) return msg.content;
        return chooseDisplayText(msg, viewerLang);
    }, [showOriginal, viewerLang]);

    const isTranslated = useCallback((msg: TranslatedChatMessage) => {
        if (showOriginal) return false;
        return wasTranslated(msg, viewerLang);
    }, [showOriginal, viewerLang]);

    return { messages, viewerLang, showOriginal, setShowOriginal, displayFor, isTranslated, sendMessage };
}

import React from 'react';
