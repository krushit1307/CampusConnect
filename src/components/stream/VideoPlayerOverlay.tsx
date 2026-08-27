// =============================================================================
// Component: VideoPlayerOverlay
//  Issue: #3553 - Build a 'Live Event "Cheer/Applause" Button'
//  Issue: #4166 - Build a 'Real-Time "Live Polling" Overlay for Streams'
//  Description: Wraps the standard HTML5 video player with the Cheer Button,
//  FloatingEmojis, and PollOverlay components. Positions the button in the
//  bottom right corner and ensures the floating emojis overlay the entire
//  viewport. The PollOverlay renders at the bottom-left when a poll is active.
//  =============================================================================

import React from "react";
import { useLiveCheer } from "../../hooks/useLiveCheer";
import { CheerButton } from "./CheerButton";
import { FloatingEmojis } from "./FloatingEmojis";
import { PollOverlay } from "./PollOverlay";
import { useAuthStore } from "@/store/useAuthStore";
import type { User } from "@supabase/supabase-js";

interface VideoPlayerOverlayProps {
  videoUrl: string;
  eventId: string;
  posterUrl?: string;
  isLive?: boolean;
  /** Whether the current viewer has moderator privileges */
  isModerator?: boolean;
}

export const VideoPlayerOverlay: React.FC<VideoPlayerOverlayProps> = ({
  videoUrl,
  eventId,
  posterUrl,
  isLive = false,
  isModerator = false,
}) => {
  const { incomingCheers, broadcastCheer } = useLiveCheer(eventId);
  const authUser = useAuthStore((s) => s.user);

  // Adapt the Zustand AuthUser shape to the Supabase User type expected
  // by PollOverlay / CreatePollDialog. Only id and email are needed.
  const supaUser: User | null = authUser
    ? ({ id: authUser.id, email: authUser.email } as unknown as User)
    : null;

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* Floating Emojis (Fixed to viewport) */}
      <FloatingEmojis cheers={incomingCheers} />

      {/* Video Player Container */}
      <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700">
        <video
          src={videoUrl}
          poster={posterUrl}
          controls
          autoPlay={isLive}
          className="w-full aspect-video"
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>

        {/* Live Badge */}
        {isLive && (
          <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full shadow-lg">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            LIVE
          </div>
        )}

        {/* Poll Overlay (Bottom Left, z-20) */}
        {isLive && <PollOverlay eventId={eventId} user={supaUser} isModerator={isModerator} />}

        {/* Cheer Button Overlay (Bottom Right) */}
        <div className="absolute bottom-6 right-6 z-10">
          <CheerButton onCheer={broadcastCheer} />
        </div>

        {/* Viewer Count (Mock) */}
        {isLive && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-black/60 text-white text-xs font-bold rounded-full backdrop-blur-sm">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path
                fillRule="evenodd"
                d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                clipRule="evenodd"
              />
            </svg>
            1,243 Watching
          </div>
        )}
      </div>
    </div>
  );
};
