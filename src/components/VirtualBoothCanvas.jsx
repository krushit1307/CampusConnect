import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

export default function VirtualBoothCanvas({ roomId, currentUserId, isOrganizer }) {
  const canvasRef = useRef(null);
  const [myPos, setMyPos] = useState({ x: 100, y: 100 });
  const [remoteUsers, setRemoteUsers] = useState({});
  const channelRef = useRef(null);

  // Setup Supabase Realtime Presence channel for 30 FPS coordinate broadcasting
  useEffect(() => {
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: currentUserId } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users = {};
      Object.keys(state).forEach((key) => {
        if (key !== currentUserId) {
          users[key] = state[key][0];
        }
      });
      setRemoteUsers(users);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ x: myPos.x, y: myPos.y, muted: false });
      }
    });

    channelRef.current = channel;

    // Handle Keyboard movement
    const handleKeyDown = (e) => {
      setMyPos((prev) => {
        let { x, y } = prev;
        const speed = 8;
        if (e.key === 'ArrowUp' || e.key === 'w') y -= speed;
        if (e.key === 'ArrowDown' || e.key === 's') y += speed;
        if (e.key === 'ArrowLeft' || e.key === 'a') x -= speed;
        if (e.key === 'ArrowRight' || e.key === 'd') x += speed;

        const updated = { x, y };
        channel.track({ ...updated, muted: false });
        return updated;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId]);

  // Render 2D Canvas & Calculate Euclidean Distance / Spatial Audio Volume
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Self
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(myPos.x, myPos.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e3a8a';
      ctx.font = '12px sans-serif';
      ctx.fillText('You', myPos.x - 10, myPos.y - 22);

      // Draw Remote Users & Compute Proximity Volume
      Object.entries(remoteUsers).forEach(([id, user]) => {
        const distance = Math.sqrt(Math.pow(user.x - myPos.x, 2) + Math.pow(user.y - myPos.y, 2));
        
        // Spatial volume fading (radius = 150px)
        let volume = 0;
        if (distance <= 150) {
          volume = Math.max(0, 1 - distance / 150);
        }

        // Draw avatar
        ctx.fillStyle = user.muted ? '#9ca3af' : '#10b981';
        ctx.beginPath();
        ctx.arc(user.x, user.y, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#065f46';
        ctx.fillText(`User (${Math.round(distance)}px)`, user.x - 20, user.y - 22);

        // Dispatch volume change to WebRTC / audio element if integrated
        const audioElement = document.getElementById(`audio-${id}`);
        if (audioElement) {
          audioElement.volume = volume;
        }
      });
    };

    const interval = setInterval(render, 1000 / 30); // 30 FPS render loop
    return () => clearInterval(interval);
  }, [myPos, remoteUsers]);

  const kickUser = (id) => {
    if (!isOrganizer) return;
    // Organizer God View action to disconnect/kick troll
    channelRef.current.send({
      type: 'broadcast',
      event: 'kick_user',
      payload: { targetId: id },
    });
  };

  return (
    <div className="virtual-booth-wrapper" style={{ textAlign: 'center' }}>
      <h3>Interactive Virtual Booth</h3>
      <p style={{ color: '#666' }}>Use Arrow Keys or WASD to move your avatar around the virtual floor.</p>
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        style={{ border: '2px solid #333', background: '#f8fafc', borderRadius: '8px' }}
      />
      {isOrganizer && (
        <div className="organizer-god-view" style={{ marginTop: '1rem', background: '#fef2f2', padding: '1rem', border: '1px solid #fca5a5' }}>
          <h4>🛡️ Organizer God View</h4>
          <ul>
            {Object.keys(remoteUsers).map((id) => (
              <li key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <span>User: {id}</span>
                <button onClick={() => kickUser(id)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>
                  Kick / Mute
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

VirtualBoothCanvas.propTypes = {
  roomId: PropTypes.string.isRequired,
  currentUserId: PropTypes.string.isRequired,
  isOrganizer: PropTypes.bool,
};
