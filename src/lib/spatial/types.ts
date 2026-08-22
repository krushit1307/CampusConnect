// =============================================================================
// Types: Spatial Lobby Domain Model
// Issue: #3687 - Build an 'Interactive "Virtual Career Fair" Spatial Lobby'
// Description: Shared types for avatar positions, booths and proximity math.
// =============================================================================

export interface Vec2 { x: number; y: number; }

export interface Booth {
    id: string;
    sponsor_name: string;
    x: number; y: number; width: number; height: number;
    logo_url: string | null;
    video_room_name: string;
}

export interface RemoteAvatar {
    userId: string;
    name: string;
    color: string;
    pos: Vec2;
    lastSeen: number;
}

export interface LobbyConfig { width: number; height: number; }

/** True when a point lies inside a booth rectangle (with a small margin). */
export function pointInBooth(p: Vec2, booth: Booth, margin = 1): boolean {
    return (
        p.x >= booth.x - margin && p.x <= booth.x + booth.width + margin &&
        p.y >= booth.y - margin && p.y <= booth.y + booth.height + margin
    );
}

/** Deterministic pastel color per user for avatar rendering. */
export function avatarColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 55%)`;
}

export const AVATAR_SPEED_FT_S = 14;   // walking speed
export const POSITION_BROADCAST_MS = 100; // network throttle
export const STALE_AVATAR_MS = 5000;
