// =============================================================================
// Component: BoothVideoPanel
// Issue: #3687 - Build an 'Interactive "Virtual Career Fair" Spatial Lobby'
// Description: Floating video-chat panel shown while the avatar stands inside
// a sponsor booth. Renders the local camera preview, connection status and a
// hang-up action; teardown also happens automatically on walk-away.
// =============================================================================

import React, { useEffect, useRef } from 'react';
import { VideoSession } from '../../hooks/useProximityVideo';

interface BoothVideoPanelProps {
    session: VideoSession;
    onLeave: () => void;
}

export const BoothVideoPanel: React.FC<BoothVideoPanelProps> = ({ session, onLeave }) => {
    const localRef = useRef<HTMLVideoElement>(null);

    // Attach the local MediaStream to the preview element
    useEffect(() => {
        if (localRef.current && session.localStream) {
            localRef.current.srcObject = session.localStream;
        }
    }, [session.localStream]);

    return (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-3 bg-indigo-600 text-white flex items-center justify-between">
                <div>
                    <p className="font-bold text-sm">{session.booth.sponsor_name}</p>
                    <p className="text-[11px] text-indigo-200">
                        {session.status === 'connecting' ? 'Connecting…' : session.status === 'live' ? '● Live video chat' : 'Camera unavailable'}
                    </p>
                </div>
                <button
                    onClick={onLeave}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-xs font-black"
                >
                    LEAVE
                </button>
            </div>

            <div className="aspect-video bg-black relative">
                <video ref={localRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                {session.status === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center text-white text-xs text-center p-4">
                        Camera/mic blocked. Allow permissions to talk with the recruiter.
                    </div>
                )}
            </div>
        </div>
    );
};
