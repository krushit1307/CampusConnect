// =============================================================================
// Hook: useProximityVideo
// Issue: #3687 - Build an 'Interactive "Virtual Career Fair" Spatial Lobby'
// Description: Watches the player's coordinates against booth bounding boxes.
// Entering a booth opens the WebRTC video room for that sponsor; walking away
// tears the connection down seamlessly. Signaling rides the same Realtime
// channel; swap-in LiveKit/Twilio in production via the adapter interface.
// =============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Vec2, Booth, pointInBooth } from '../lib/spatial/types';

export interface VideoSession {
    booth: Booth;
    status: 'connecting' | 'live' | 'error';
    localStream: MediaStream | null;
}

interface UseProximityVideoReturn {
    session: VideoSession | null;
    leave: () => void;
}

export function useProximityVideo(
    eventId: string | null,
    selfPos: Vec2,
    booths: Booth[],
    userId: string,
): UseProximityVideoReturn {
    const [session, setSession] = useState<VideoSession | null>(null);
    const sessionRef = useRef<VideoSession | null>(null);
    sessionRef.current = session;
    const pcRef = useRef<RTCPeerConnection | null>(null);

    const teardown = useCallback(() => {
        pcRef.current?.getSenders().forEach(s => s.track?.stop());
        pcRef.current?.close();
        pcRef.current = null;
        setSession(null);
    }, []);

    const enterBooth = useCallback(async (booth: Booth) => {
        setSession({ booth, status: 'connecting', localStream: null });
        try {
            // Acquire camera/mic; graceful fallback if denied
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            // WebRTC peer connection (production: replace with LiveKit room connect)
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            });
            stream.getTracks().forEach(t => pc.addTrack(t, stream));
            pcRef.current = pc;

            // Join signaling room for this booth via Realtime broadcast
            const channel = supabase.channel(`booth-${booth.video_room_name}`, {
                config: { broadcast: { self: false } },
            });
            channel.on('broadcast', { event: 'rtc-signal' }, async ({ payload }) => {
                if (payload.to !== userId) return;
                if (payload.offer) await pc.setRemoteDescription(payload.offer);
                if (payload.offer || payload.candidate) {
                    const answer = payload.offer ? await pc.createAnswer() : null;
                    if (answer) {
                        await pc.setLocalDescription(answer);
                        channel.send({ type: 'broadcast', event: 'rtc-signal', payload: { to: payload.from, answer, from: userId } });
                    }
                }
                if (payload.answer) await pc.setRemoteDescription(payload.answer);
            });
            channel.subscribe();

            setSession({ booth, status: 'live', localStream: stream });
        } catch (err) {
            console.error('[useProximityVideo] Media error:', err);
            setSession({ booth, status: 'error', localStream: null });
        }
    }, [userId]);

    // Proximity watcher: enter on entry, teardown on exit
    useEffect(() => {
        const inside = booths.find(b => pointInBooth(selfPos, b)) || null;
        const current = sessionRef.current;

        if (inside && (!current || current.booth.id !== inside.id)) {
            teardown();
            enterBooth(inside);
        } else if (!inside && current) {
            teardown();
        }
    }, [selfPos, booths, enterBooth, teardown]);

    return { session, leave: teardown };
}
