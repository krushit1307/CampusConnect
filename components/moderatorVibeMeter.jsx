import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');

export default function ModeratorVibeMeter({ eventId }) {
    const [sentimentScore, setSentimentScore] = useState(0.0);
    const [isHostile, setIsHostile] = useState(false);
    const [warningMessage, setWarningMessage] = useState(null);

    useEffect(() => {
        // Subscribe to real-time moderator vibe updates
        const subscription = supabase
            .channel(`moderator_${eventId}`)
            .on('broadcast', { event: 'vibe_update' }, payload => {
                setSentimentScore(payload.payload.rolling_sentiment);
                setIsHostile(payload.payload.is_hostile);
                setWarningMessage(payload.payload.warning_message);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [eventId]);

    // Determine color and mood label based on score (-5 to +5)
    const getMoodDetails = (score) => {
        if (score <= -3.0) return { label: 'Hostile / Angry', color: '#e74c3c' };
        if (score < -1.0) return { label: 'Tense / Concerned', color: '#e67e22' };
        if (score <= 1.0) return { label: 'Neutral / Calm', color: '#f1c40f' };
        return { label: 'Positive / Supportive', color: '#2ecc71' };
    };

    const mood = getMoodDetails(sentimentScore);

    return (
        <div style={{ background: isHostile ? '#ffebee' : '#111', color: isHostile ? '#333' : '#fff', padding: '30px', borderRadius: '12px', border: isHostile ? '3px solid #e74c3c' : '1px solid #333', textAlign: 'center', transition: 'all 0.3s ease' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '15px' }}>🌡️ Real-Time Crowd Vibe Meter</h2>
            
            {/* Hostile Warning Flash */}
            {warningMessage && (
                <div style={{ background: '#e74c3c', color: '#fff', padding: '15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '18px', marginBottom: '20px', animation: 'pulse 1s infinite' }}>
                    {warningMessage}
                </div>
            )}

            {/* Dial / Score Display */}
            <div style={{ fontSize: '48px', fontWeight: 'bold', color: mood.color, margin: '10px 0' }}>
                {sentimentScore > 0 ? `+${sentimentScore}` : sentimentScore}
            </div>
            <div style={{ fontSize: '20px', textTransform: 'uppercase', letterSpacing: '1px', color: mood.color, fontWeight: '600' }}>
                {mood.label}
            </div>
            
            <p style={{ marginTop: '15px', opacity: 0.7, fontSize: '14px' }}>
                Aggregated rolling sentiment calculated from the last 50 incoming Q&A messages.
            </p>
        </div>
    );
}
