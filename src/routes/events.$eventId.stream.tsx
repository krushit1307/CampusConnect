import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SiteShell } from '@/components/site/SiteShell';
import { TactileFeedbackPlayer } from '@/components/accessibility/TactileFeedbackPlayer';
import { LivestreamAudioStream } from '@/types/accessibilityHaptics';
import {
  Radio,
  ArrowLeft,
  Vibrate,
  Sparkles,
  Volume2,
  Users,
  ShieldCheck,
  Music,
  Share2,
} from 'lucide-react';

export default function EventLiveStreamPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const [streamInfo] = useState<LivestreamAudioStream>({
    streamId: `stream-${eventId || 'live-concert'}`,
    eventName: 'Annual Campus Electronic Music & Visual Arts Festival',
    performer: 'DJ Neon Pulse ft. University Symphony Bassline',
    isBroadcasting: true,
    activeListeners: 412,
    hapticsEnabled: true,
    sampleRate: 44100,
    currentBpm: 128,
  });

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Top Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-black pb-6">
            <div className="flex items-center gap-3">
              <Link
                to={`/events/${eventId || ''}`}
                className="neu-border bg-white p-2.5 hover:bg-gray-50 flex items-center justify-center transition-transform hover:-translate-y-0.5"
              >
                <ArrowLeft size={18} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-lime border-2 border-black rounded shadow-xs">
                    <Music size={20} />
                  </span>
                  <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight text-black">
                    Live Concert & Tactile Haptic Stream
                  </h1>
                </div>
                <p className="font-mono text-xs text-gray-600 mt-0.5">
                  Universal accessibility stream translating live frequency spectrum into synchronized device haptic pulses.
                </p>
              </div>
            </div>

            {/* Accessibility Guarantee Badge */}
            <div className="flex items-center gap-2 bg-white px-3.5 py-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono text-xs font-bold text-gray-700">
              <ShieldCheck size={18} className="text-emerald-600" />
              <span>Somatosensory Tactile Feedback Engine Active</span>
            </div>
          </div>

          {/* Player Stream Section */}
          <TactileFeedbackPlayer streamInfo={streamInfo} />

          {/* Information & Accessibility Callout */}
          <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
            <h4 className="font-display font-black text-base text-black flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" /> How Tactile Audio Accessibility Works
            </h4>
            <p className="font-mono text-xs leading-relaxed text-gray-700">
              Our broadcasting pipeline performs real-time Fast Fourier Transform (FFT) on incoming concert audio.
              Low-frequency sub-bass waveforms (20Hz–100Hz) are extracted and converted into high-frequency haptic packets.
              Mobile devices synthesize these packets via the browser <code className="bg-slate-100 px-1 py-0.5 border border-slate-300 rounded text-black font-bold">navigator.vibrate()</code> API,
              allowing deaf, hard-of-hearing, and sensory-oriented attendees to experience bass drops and musical energy through tactile touch.
            </p>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
