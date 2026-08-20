import React, { useRef, useState, useEffect } from 'react';
import Hls from 'hls.js';
import { createClient } from '@/lib/supabase/client';

interface VideoPlayerProps {
  streamId: string;
  srcUrl: string; // Target path pointing to live `.m3u8` HLS Manifest Stream
}

const supabase = createClient();

export default function LiveClipVideoPlayer({ streamId, srcUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [clipping, setClipping] = useState<boolean>(false);
  const [clipUrl, setClipUrl] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');

  useEffect(() => {
    let hlsInstance: Hls | null = null;
    const videoElement = videoRef.current;

    if (videoElement) {
      if (Hls.isSupported()) {
        hlsInstance = new Hls({
          liveSyncDurationCount: 3, // Synchronize strictly near the real-time live edge
          maxBufferLength: 60,       // Enforce a minimum rolling buffer length over 30s
        });
        hlsInstance.loadSource(srcUrl);
        hlsInstance.attachMedia(videoElement);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLive(true);
        });
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Native Safari fallback handling
        videoElement.src = srcUrl;
        setIsLive(true);
      }
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [srcUrl]);

  const handleCaptureClip = async () => {
    const video = videoRef.current;
    if (!video || clipping) return;

    setClipping(true);
    setClipUrl('');
    setErrorText('');

    // 1. Extract context pointers from player timeline markers
    const currentPlayheadTime = video.currentTime; 
    const clipStartTime = Math.max(0, currentPlayheadTime - 30); // Capture the preceding 30-second window

    try {
      // 2. Offload extraction tasks securely to the edge processing workers
      const { data, error } = await supabase.functions.invoke('generate-clip', {
        body: {
          streamId,
          start: Math.round(clipStartTime),
          end: Math.round(currentPlayheadTime),
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to extract video clip via edge worker.');
      }

      setClipUrl(data?.shareableUrl || '');
    } catch (err: any) {
      setErrorText(err.message || 'Network exception during rendering loops.');
    } finally {
      setClipping(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto p-4 bg-gray-950 rounded-2xl shadow-2xl border border-gray-800">
      {/* Target Media Render Context Container */}
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-inner group">
        <video 
          ref={videoRef} 
          controls 
          muted
          className="w-full h-full object-cover"
        />
        {isLive && (
          <span className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" /> Live
          </span>
        )}
      </div>

      {/* Control Triggers Bar Frame */}
      <div className="w-full mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-white">Interactive Panel Console</h4>
          <p className="text-xs text-gray-400 mt-0.5">Catch a notable insight? Clip the last 30 seconds instantly to social timelines.</p>
        </div>

        <button
          onClick={handleCaptureClip}
          disabled={clipping || !isLive}
          className="relative inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs uppercase tracking-widest rounded-xl transition shadow disabled:opacity-40"
        >
          {clipping ? (
            <>
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Rendering...
            </>
          ) : (
            '🎬 Clip Last 30s'
          )}
        </button>
      </div>

      {/* Output Asset Display Panel */}
      {clipUrl && (
        <div className="w-full mt-4 p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center justify-between gap-4 animate-fadeIn">
          <div>
            <span className="block text-[10px] font-black uppercase tracking-wider text-emerald-400">Clip Compiled Successfully</span>
            <p className="text-xs text-emerald-200 mt-0.5">Your social-share optimized Open Graph URL is live.</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(clipUrl);
              alert('Copied clip URL to clipboard!');
            }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
          >
            🔗 Copy Share Link
          </button>
        </div>
      )}

      {errorText && (
        <div className="w-full mt-4 p-3 bg-red-950/40 border border-red-900/60 text-red-400 text-xs font-medium rounded-xl">
          ⚠️ Extraction Error: {errorText}
        </div>
      )}
    </div>
  );
}
