import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export default function LiveEventPlayer({ eventId, userId, playbackId }) {
    const videoRef = useRef(null);
    const playerRef = useRef(null);

    useEffect(() => {
        // Initialize Video.js HLS Player using Mux playback ID
        if (!playerRef.current) {
            const videoElement = videoRef.current;
            if (!videoElement) return;

            playerRef.current = videojs(videoElement, {
                autoplay: true,
                controls: true,
                responsive: true,
                fluid: true,
                sources: [{
                    src: `https://stream.mux.com/${playbackId}.m3u8`,
                    type: 'application/x-mpegURL'
                }]
            });
        }

        // Heartbeat timer: ping backend every 60 seconds to track viewing duration
        const heartbeatInterval = setInterval(() => {
            if (playerRef.current && !playerRef.current.paused()) {
                fetch('/api/streams/ping', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, event_id: eventId })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.attended_recorded) {
                        console.log("Verified: Attendance marked for 15+ minutes of viewing.");
                    }
                })
                .catch(err => console.error("Heartbeat error:", err));
            }
        }, 60000);

        return () => {
            clearInterval(heartbeatInterval);
            if (playerRef.current) {
                playerRef.current.dispose();
                playerRef.current = null;
            }
        };
    }, [playbackId, eventId, userId]);

    return (
        <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
            <div data-vjs-player>
                <video ref={videoRef} className="video-js vjs-big-play-centered" />
            </div>
            <div style={{ background: '#f2f7f7', padding: '15px', textAlign: 'center', fontSize: '14px', color: '#088178', fontWeight: 'bold' }}>
                🔴 Live Broadcast • Stay tuned for 15 minutes to automatically verify attendance.
            </div>
        </div>
    );
}
