// =============================================================================
// Hook: useLiveCheer
// Issue: #3553 - Build a 'Live Event "Cheer/Applause" Button'
// Description: Manages the Supabase Realtime subscription for incoming cheer
// events from other viewers.Provides a function to broadcast the user's own
// batched cheers to the channel.
    // =============================================================================

    import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import { createCheerBatcher, CheerBatch } from '../../lib/realtime/cheerBatcher';

export interface IncomingCheer {
    id: string; // Unique ID for React key
    emojis: { emoji: string; x_position: number }[];
    timestamp: number;
}

interface UseLiveCheerReturn {
    incomingCheers: IncomingCheer[];
    broadcastCheer: (emoji: string, xPosition: number) => void;
    clearCheers: () => void;
}

export function useLiveCheer(eventId: string | null): UseLiveCheerReturn {
    const [incomingCheers, setIncomingCheers] = useState<IncomingCheer[]>([]);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const batcherRef = useRef<ReturnType<typeof createCheerBatcher> | null>(null);

    // Clean up old cheers from state after animation completes (3 seconds)
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setIncomingCheers(prev => prev.filter(c => now - c.timestamp < 3500));
        }, 500);

        return () => clearInterval(interval);
    }, []);

    // Subscribe to Realtime channel for incoming cheers
    useEffect(() => {
        if (!eventId) return;

        const channel = supabase.channel(`live-cheer-${eventId}`, {
            config: { broadcast: { self: false } } // Don't receive our own broadcasts
        });

        channel.on('broadcast', { event: 'cheer_batch' }, ({ payload }) => {
            const batch = payload as CheerBatch;
            setIncomingCheers(prev => [
                ...prev,
                {
                    id: `${batch.timestamp}-${Math.random()}`,
                    emojis: batch.emojis,
                    timestamp: batch.timestamp
                }
            ]);
        });

        channel.subscribe();
        channelRef.current = channel;

        // Initialize the batcher for outgoing cheers
        batcherRef.current = createCheerBatcher(eventId, (batch) => {
            channel.send({
                type: 'broadcast',
                event: 'cheer_batch',
                payload: batch
            });
        });

        return () => {
            if (channelRef.current) supabase.removeChannel(channelRef.current);
            if (batcherRef.current) batcherRef.current.destroy();
        };
    }, [eventId]);

    const broadcastCheer = useCallback((emoji: string, xPosition: number) => {
        if (batcherRef.current) {
            batcherRef.current.addCheer(emoji, xPosition);

            // Also add to local state immediately so the user sees their own cheer
            setIncomingCheers(prev => [
                ...prev,
                {
                    id: `local-${Date.now()}-${Math.random()}`,
                    emojis: [{ emoji, x_position: xPosition }],
                    timestamp: Date.now()
                }
            ]);
        }
    }, []);

    const clearCheers = useCallback(() => {
        setIncomingCheers([]);
    }, []);

    return { incomingCheers, broadcastCheer, clearCheers };
}
