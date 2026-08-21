// =============================================================================
// Component: SpatialLobbyCanvas
// Issue: #3687 - Build an 'Interactive "Virtual Career Fair" Spatial Lobby'
// Description: HTML5 canvas rendering the fair hall: booths, walking avatars
// (WASD/arrows), remote peers interpolated from Realtime broadcasts. Entering
// a booth's bounding box opens that sponsor's video room (proximity hook).
// =============================================================================

import React, { useEffect, useRef } from 'react';
import { useSpatialLobby } from '../../hooks/useSpatialLobby';
import { useProximityVideo } from '../../hooks/useProximityVideo';
import { BoothVideoPanel } from './BoothVideoPanel';
import { AVATAR_SPEED_FT_S } from '../../lib/spatial/types';

const FT_TO_PX = 8;

interface SpatialLobbyCanvasProps {
  eventId: string;
  userId: string;
  userName: string;
}

export const SpatialLobbyCanvas: React.FC<SpatialLobbyCanvasProps> = ({ eventId, userId, userName }) => {
  const { selfPos, remoteAvatars, booths, lobby, move } = useSpatialLobby(eventId, userId, userName);
  const { session, leave } = useProximityVideo(eventId, selfPos, booths, userId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const stateRef = useRef({ selfPos, remoteAvatars, booths, lobby });
  stateRef.current = { selfPos, remoteAvatars, booths, lobby };

  // Keyboard listeners
  useEffect(() => {
    const down = (e: KeyboardEvent) => keysRef.current.add(e.key.toLowerCase());
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // rAF loop: movement + draw
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Derive movement vector from pressed keys
      const keys = keysRef.current;
      let dx = 0, dy = 0;
      if (keys.has('w') || keys.has('arrowup')) dy -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dy += 1;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        move(dx / len, dy / len, dt);
      }

      draw();
      raf = requestAnimationFrame(loop);
    };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { selfPos: sp, remoteAvatars: remotes, booths: bths, lobby: lb } = stateRef.current;

      const W = lb.width * FT_TO_PX, H = lb.height * FT_TO_PX;
      if (canvas.width !== W) { canvas.width = W; canvas.height = H; }

      // Floor
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#e5e7eb';
      for (let x = 0; x < W; x += FT_TO_PX * 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += FT_TO_PX * 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Booths
      for (const b of bths) {
        ctx.fillStyle = 'rgba(99,102,241,0.15)';
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.fillRect(b.x * FT_TO_PX, b.y * FT_TO_PX, b.width * FT_TO_PX, b.height * FT_TO_PX);
        ctx.strokeRect(b.x * FT_TO_PX, b.y * FT_TO_PX, b.width * FT_TO_PX, b.height * FT_TO_PX);
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.sponsor_name, (b.x + b.width / 2) * FT_TO_PX, (b.y + b.height / 2) * FT_TO_PX);
      }

      // Remote avatars
      for (const a of remotes) {
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.arc(a.pos.x * FT_TO_PX, a.pos.y * FT_TO_PX, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.font = '10px sans-serif';
        ctx.fillText(a.name.slice(0, 10), a.pos.x * FT_TO_PX, a.pos.y * FT_TO_PX - 14);
      }

      // Self avatar
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(sp.x * FT_TO_PX, sp.y * FT_TO_PX, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [move]);

  return (
    <div className="relative space-y-3">
      <canvas
        ref={canvasRef}
        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner bg-white dark:bg-gray-800"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Walk with <kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded">WASD</kbd> / arrow keys.
        Step into a sponsor booth to open a live video chat — walk away to hang up.
      </p>

      {/* Proximity video overlay */}
      {session && <BoothVideoPanel session={session} onLeave={leave} />}
    </div>
  );
};
