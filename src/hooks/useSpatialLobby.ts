// =============================================================================
// Hook: useSpatialLobby
// Issue: #3687 - Build an 'Interactive "Virtual Career Fair" Spatial Lobby'
// Description: Owns the player position, keyboard movement, and the Realtime
// broadcast of X/Y coordinates. Renders remote avatars from broadcast events
// and prunes stale peers.
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
    Vec2, Booth, RemoteAvatar, LobbyConfig,
    avatarColor, AVATAR_SPEED_FT_S, POSITION_BROADCAST_MS, STALE_AVATAR_MS,
} from '../lib/spatial/types';

interface UseSpatialLobbyReturn {
    selfPos: Vec2;
    remoteAvatars: RemoteAvatar[];
    booths: Booth[];
    lobby: LobbyConfig;
    move: (dx: number, dy: number, dt: number) => void;
}

export function useSpatialLobby(eventId: string | null, userId: string, userName: string): UseSpatialLobbyReturn {
    const [selfPos, setSelfPos] = useState<Vec2>({ x: 60, y: 40 });
    const [remoteAvatars, setRemoteAvatars] = useState<RemoteAvatar[]>([]);
    const [booths, setBooths] = useState<Booth[]>([]);
    const [lobby, setLobby] = useState<LobbyConfig>({ width: 120, height: 80 });

    const channelRef = useRef<RealtimeChannel | null>(null);
    const lastBroadcastRef = useRef(0);
    const selfPosRef = useRef(selfPos);
    selfPosRef.current = selfPos;

    // Load lobby bounds + booth bounding boxes
    useEffect(() => {
        const load = async () => {
            if (!eventId) return;
            const [{ data: ev }, { data: boothRows }] = await Promise.all([
                supabase.from('events').select('lobby_width_ft, lobby_height_ft').eq('id', eventId).single(),
                supabase.from('career_fair_booths').select('*').eq('event_id', eventId),
            ]);
            if (ev) setLobby({ width: Number(ev.lobby_width_ft), height: Number(ev.lobby_height_ft) });
            setBooths(((boothRows as any[]) || []).map(b => ({
                id: b.id, sponsor_name: b.sponsor_name,
                x: Number(b.x_ft), y: Number(b.y_ft),
                width: Number(b.width_ft), height: Number(b.height_ft),
                logo_url: b.logo_url, video_room_name: b.video_room_name,
            })));
        };
        load();
    }, [eventId]);

    // Realtime channel: broadcast own position, ingest remote positions
    useEffect(() => {
        if (!eventId) return;
        const channel = supabase.channel(`fair-lobby-${eventId}`, {
            config: { broadcast: { self: false } },
        });

        channel.on('broadcast', { event: 'position' }, ({ payload }) => {
            if (payload.userId === userId) return;
            setRemoteAvatars(prev => {
                const existing = prev.find(a => a.userId === payload.userId);
                const next: RemoteAvatar = {
                    userId: payload.userId,
                    name: payload.name,
                    color: avatarColor(payload.userId),
                    pos: payload.pos,
                    lastSeen: Date.now(),
                };
                return existing
                    ? prev.map(a => (a.userId === payload.userId ? next : a))
                    : [...prev, next];
            });
        });

        channel.subscribe();
        channelRef.current = channel;

        // Prune stale avatars on an interval
        const pruner = setInterval(() => {
            setRemoteAvatars(prev => prev.filter(a => Date.now() - a.lastSeen < STALE_AVATAR_MS));
        }, 2000);

        return () => {
            clearInterval(pruner);
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [eventId, userId]);

    // Move the player (called from the canvas rAF loop) + throttled broadcast
    const move = useCallback((dx: number, dy: number, dt: number) => {
        setSelfPos(prev => {
            const next = {
                x: Math.min(Math.max(1, prev.x + dx * AVATAR_SPEED_FT_S * dt), lobby.width - 1),
                y: Math.min(Math.max(1, prev.y + dy * AVATAR_SPEED_FT_S * dt), lobby.height - 1),
            };
            const now = Date.now();
            if (now - lastBroadcastRef.current >= POSITION_BROADCAST_MS && channelRef.current) {
                lastBroadcastRef.current = now;
                channelRef.current.send({
                    type: 'broadcast', event: 'position',
                    payload: { userId, name: userName, pos: next },
                });
            }
            return next;
        });
    }, [lobby.width, lobby.height, userId, userName]);

    return { selfPos, remoteAvatars, booths, lobby, move };
}
