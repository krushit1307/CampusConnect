// =============================================================================
// Component: PitchVideoCard
// Issue: #3681 - Build an 'Interactive "Club Pitch" Video Carousel'
// Description: A vertical 9:16 video card with muted autoplay driven by the
// IntersectionObserver hook, club branding overlay and a prominent Join button.
// =============================================================================

import React from 'react';
import { useAutoplayObserver } from '../../hooks/useAutoplayObserver';

export interface PitchClub {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    pitch_video_url: string | null;
    member_count?: number;
}

interface PitchVideoCardProps {
    club: PitchClub;
    isMember: boolean;
    onJoin: (clubId: string) => void;
}

export const PitchVideoCard: React.FC<PitchVideoCardProps> = ({ club, isMember, onJoin }) => {
    const { containerRef, videoRef, isInView } = useAutoplayObserver();

    return (
        <div
            ref={containerRef}
            className="relative w-64 sm:w-72 shrink-0 snap-center aspect-[9/16] rounded-2xl overflow-hidden bg-gray-900 dark:bg-black shadow-lg border border-gray-200 dark:border-gray-800 group"
        >
            {/* Vertical pitch video (muted autoplay) */}
            {club.pitch_video_url ? (
                <video
                    ref={videoRef}
                    src={club.pitch_video_url}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700">
                    <span className="text-5xl font-black text-white/80">{club.name.charAt(0)}</span>
                </div>
            )}

            {/* Bottom gradient for legibility */}
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

            {/* Live indicator while auto-playing */}
            {isInView && club.pitch_video_url && (
                <span className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/50 text-white text-[10px] font-bold backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> AUTO-PLAY
                </span>
            )}

            {/* Club identity */}
            <div className="absolute inset-x-0 bottom-0 p-4 space-y-3">
                <div className="flex items-center gap-2">
                    {club.logo_url && (
                        <img src={club.logo_url} alt="" className="w-8 h-8 rounded-full border border-white/40 object-cover" />
                    )}
                    <div className="min-w-0">
                        <h3 className="text-white font-bold text-sm truncate">{club.name}</h3>
                        {typeof club.member_count === 'number' && (
                            <p className="text-white/70 text-[11px]">{club.member_count} members</p>
                        )}
                    </div>
                </div>

                {/* Loud, prominent Join CTA hovering over the video */}
                <button
                    onClick={() => onJoin(club.id)}
                    disabled={isMember}
                    className={`w-full py-2.5 rounded-xl font-black text-sm tracking-wide shadow-xl transition-transform active:scale-95 ${isMember
                            ? 'bg-white/20 text-white backdrop-blur-sm cursor-default'
                            : 'bg-white text-gray-900 hover:scale-[1.03]'
                        }`}
                >
                    {isMember ? '✓ JOINED' : 'JOIN CLUB'}
                </button>
            </div>
        </div>
    );
};
