// =============================================================================
// Hook: useLiveSentiment
// Issue: #3230 - Implement 'Live Audience Sentiment Analysis'
// Description: Subscribes to the live chat WebSocket channel, scores incoming 
// messages in real-time using the NLP analyzer, and maintains a rolling window 
// of the last 50 messages to calculate the aggregate sentiment gauge value.
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import { analyzeSentiment, calculateRollingAverage, SentimentResult } from '../../lib/nlp/sentimentAnalyzer';

export interface SentimentState {
    currentScore: number;       // Rolling average (-5 to +5)
    messageCount: number;       // Total messages in the rolling window
    engagementLevel: 'silent' | 'low' | 'moderate' | 'high';
    trend: 'improving' | 'declining' | 'stable';
    isConfusionSpike: boolean;  // True if a sudden wave of "???" is detected
}

interface UseLiveSentimentReturn {
    state: SentimentState;
    recentMessages: SentimentResult[];
    isActive: boolean;
    error: string | null;
}

const ROLLING_WINDOW_SIZE = 50; // Keep last 50 messages
const SILENCE_THRESHOLD_MS = 60000; // 1 minute of no messages = "Silent"
const CONFUSION_SPIKE_THRESHOLD = 3; // 3 confusion spikes in 10 messages

export function useLiveSentiment(eventId: string | null): UseLiveSentimentReturn {
    const [recentMessages, setRecentMessages] = useState<SentimentResult[]>([]);
    const [state, setState] = useState<SentimentState>({
        currentScore: 0,
        messageCount: 0,
        engagementLevel: 'silent',
        trend: 'stable',
        isConfusionSpike: false
    });
    const [isActive, setIsActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const channelRef = useRef<RealtimeChannel | null>(null);
    const lastMessageTimeRef = useRef<number>(Date.now());
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Calculate engagement level based on message frequency
    const calculateEngagement = useCallback((messages: SentimentResult[]): 'silent' | 'low' | 'moderate' | 'high' => {
        if (messages.length < 5) return 'low';
        if (messages.length < 20) return 'moderate';
        return 'high';
    }, []);

    // Calculate trend by comparing first half of window to second half
    const calculateTrend = useCallback((messages: SentimentResult[]): 'improving' | 'declining' | 'stable' => {
        if (messages.length < 10) return 'stable';

        const mid = Math.floor(messages.length / 2);
        const olderHalf = messages.slice(0, mid);
        const newerHalf = messages.slice(mid);

        const olderAvg = calculateRollingAverage(olderHalf.map(m => m.normalized));
        const newerAvg = calculateRollingAverage(newerHalf.map(m => m.normalized));

        const diff = newerAvg - olderAvg;
        if (diff > 0.5) return 'improving';
        if (diff < -0.5) return 'declining';
        return 'stable';
    }, []);

    // Detect confusion spikes in the last N messages
    const detectConfusionSpike = useCallback((messages: SentimentResult[]): boolean => {
        const recentWindow = messages.slice(-10); // Look at last 10 messages
        const confusionCount = recentWindow.filter(m => m.isConfusionSpike).length;
        return confusionCount >= CONFUSION_SPIKE_THRESHOLD;
    }, []);

    const processMessage = useCallback((text: string) => {
        const result = analyzeSentiment(text);

        // Ignore completely neutral/empty messages (e.g., just emojis or links)
        if (result.score === 0 && result.positiveWords.length === 0 && result.negativeWords.length === 0) {
            return;
        }

        lastMessageTimeRef.current = Date.now();

        setRecentMessages(prev => {
            // Maintain rolling window size
            const updated = [...prev, result];
            if (updated.length > ROLLING_WINDOW_SIZE) {
                updated.shift(); // Remove oldest message
            }

            // Recalculate aggregate state
            const newScore = calculateRollingAverage(updated.map(m => m.normalized));

            setState({
                currentScore: newScore,
                messageCount: updated.length,
                engagementLevel: calculateEngagement(updated),
                trend: calculateTrend(updated),
                isConfusionSpike: detectConfusionSpike(updated)
            });

            return updated;
        });
    }, [calculateEngagement, calculateTrend, detectConfusionSpike]);

    // Monitor for silence (no messages for 1 minute)
    useEffect(() => {
        if (!eventId) return;

        silenceTimerRef.current = setInterval(() => {
            const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current;
            if (timeSinceLastMessage > SILENCE_THRESHOLD_MS && state.engagementLevel !== 'silent') {
                setState(prev => ({
                    ...prev,
                    engagementLevel: 'silent',
                    // Don't reset the score, just mark as silent so the UI can fade out
                }));
            }
        }, 5000); // Check every 5 seconds

        return () => {
            if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
        };
    }, [eventId, state.engagementLevel]);

    // Subscribe to Supabase Realtime Chat Channel
    useEffect(() => {
        if (!eventId) return;

        setIsActive(true);
        setError(null);

        const channel = supabase
            .channel(`event-chat-${eventId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'event_chat_messages', filter: `event_id=eq.${eventId}` },
                (payload) => {
                    const newMessage = payload.new as any;
                    if (newMessage && newMessage.content) {
                        processMessage(newMessage.content);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[useLiveSentiment] Subscribed to chat channel.');
                } else if (status === 'CHANNEL_ERROR') {
                    setError('Failed to connect to live chat.');
                }
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [eventId, processMessage]);

    return {
        state,
        recentMessages,
        isActive,
        error
    };
}
