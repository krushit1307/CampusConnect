import React, { useState, useEffect, useRef } from 'react';
import { HapticPayload, LivestreamAudioStream } from '@/types/accessibilityHaptics';
import {
  processAudioFftToHaptics,
  triggerDeviceVibration,
} from '@/lib/accessibility/audioHaptics';
import {
  Activity,
  Vibrate,
  Radio,
  Volume2,
  VolumeX,
  Sparkles,
  Sliders,
  Flame,
  ShieldCheck,
} from 'lucide-react';

interface TactileFeedbackPlayerProps {
  streamInfo: LivestreamAudioStream;
}

export function TactileFeedbackPlayer({ streamInfo }: TactileFeedbackPlayerProps) {
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [hapticIntensityMultiplier, setHapticIntensityMultiplier] = useState<number>(1.0);
  const [latestPayload, setLatestPayload] = useState<HapticPayload>({
    timestamp: Date.now(),
    bassAmplitude: 195,
    midAmplitude: 140,
    trebleAmplitude: 90,
    vibrationDurationMs: 85,
    intensityPercent: 76,
    frequencyBand: 'bass',
  });
  const [isVibratingActive, setIsVibratingActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Simulate real-time FFT audio stream & haptic synthesis
  useEffect(() => {
    const mockFftData = new Uint8Array(1024);

    const interval = setInterval(() => {
      // Simulate live EDM / concert bass drop waveform dynamics
      const beatCycle = Math.sin(Date.now() / 400);
      const isDrop = beatCycle > 0.6;

      for (let i = 0; i < mockFftData.length; i++) {
        if (i <= 6) {
          // Bass bins
          mockFftData[i] = isDrop
            ? Math.min(255, Math.floor(200 + Math.random() * 55))
            : Math.floor(60 + Math.random() * 80);
        } else {
          mockFftData[i] = Math.floor(40 + Math.random() * 120);
        }
      }

      const payload = processAudioFftToHaptics(mockFftData, 44100, 2048);
      const adjustedDuration = Math.round(payload.vibrationDurationMs * hapticIntensityMultiplier);
      const adjustedPayload = {
        ...payload,
        vibrationDurationMs: adjustedDuration,
        intensityPercent: Math.min(100, Math.round(payload.intensityPercent * hapticIntensityMultiplier)),
      };

      setLatestPayload(adjustedPayload);

      if (hapticsEnabled && adjustedDuration > 0) {
        setIsVibratingActive(true);
        triggerDeviceVibration(adjustedDuration);
        setTimeout(() => setIsVibratingActive(false), adjustedDuration);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [hapticsEnabled, hapticIntensityMultiplier]);

  // Render Live FFT Frequency Spectrum on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / 24) - 2;
    const isBassDrop = latestPayload.bassAmplitude > 180;

    for (let i = 0; i < 24; i++) {
      let height = 0;
      if (i < 4) {
        // Low Frequency (Bass)
        height = (latestPayload.bassAmplitude / 255) * canvas.height * (0.7 + Math.random() * 0.3);
        ctx.fillStyle = isBassDrop ? '#bef264' : '#84cc16'; // Lime
      } else if (i < 14) {
        // Mids
        height = (latestPayload.midAmplitude / 255) * canvas.height * (0.6 + Math.random() * 0.4);
        ctx.fillStyle = '#38bdf8'; // Sky Blue
      } else {
        // Treble
        height = (latestPayload.trebleAmplitude / 255) * canvas.height * (0.5 + Math.random() * 0.5);
        ctx.fillStyle = '#c084fc'; // Purple
      }

      ctx.fillRect(i * (barWidth + 2), canvas.height - height, barWidth, height);
    }
  }, [latestPayload]);

  return (
    <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-6">
      {/* Stream Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display font-black text-xl text-black">
              {streamInfo.eventName}
            </h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse">
              <Radio size={12} className="text-red-600" /> LIVE BROADCAST
            </span>
          </div>
          <p className="font-mono text-xs text-gray-600">
            Performer: {streamInfo.performer} • {streamInfo.activeListeners} live listeners • Real-time Tactile Frequency Translation Active
          </p>
        </div>

        {/* Haptic Mode Toggle */}
        <button
          onClick={() => setHapticsEnabled(!hapticsEnabled)}
          className={`neu-border px-4 py-2 font-mono text-xs font-black uppercase flex items-center gap-2 transition-all ${
            hapticsEnabled
              ? 'bg-lime text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              : 'bg-slate-100 text-gray-500'
          }`}
        >
          <Vibrate size={16} />
          {hapticsEnabled ? 'Tactile Haptics: ON' : 'Tactile Haptics: OFF'}
        </button>
      </div>

      {/* Main Visualizer and Haptic Feedback Pulse Chamber */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live FFT Frequency Canvas */}
        <div className="lg:col-span-2 bg-slate-900 border-2 border-black rounded-lg p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-gray-400 mb-2">
            <span className="flex items-center gap-1 text-lime font-bold">
              <Activity size={14} /> Fast Fourier Transform (FFT) 20Hz - 20kHz
            </span>
            <span>BPM: {streamInfo.currentBpm}</span>
          </div>

          <div className="h-44 w-full">
            <canvas
              ref={canvasRef}
              width={500}
              height={180}
              className="w-full h-full block"
            />
          </div>

          <div className="flex justify-between font-mono text-[10px] text-gray-400 pt-2 border-t border-slate-800">
            <span className="text-lime font-bold">Sub-Bass (20-100Hz)</span>
            <span className="text-sky-400">Mid-Range (100-2kHz)</span>
            <span className="text-purple-400">Treble (&gt;2kHz)</span>
          </div>
        </div>

        {/* Right Col: Haptic Tactile Sensation Meter */}
        <div
          className={`border-2 border-black rounded-lg p-5 flex flex-col justify-between space-y-4 transition-all duration-100 ${
            isVibratingActive
              ? 'bg-lime/30 ring-4 ring-lime scale-[1.02] shadow-lg'
              : 'bg-slate-50'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs font-bold uppercase text-gray-700">
                Tactile Bass Pulse
              </span>
              <span className="p-1 bg-black text-lime rounded font-mono text-xs font-black">
                {latestPayload.intensityPercent}%
              </span>
            </div>

            <div className="w-full h-4 bg-slate-200 border border-black rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-100 ${
                  latestPayload.bassAmplitude > 180 ? 'bg-lime' : 'bg-amber-400'
                }`}
                style={{ width: `${latestPayload.intensityPercent}%` }}
              />
            </div>
          </div>

          {/* Sensation Feedback Pill */}
          <div className="p-3 bg-white border border-black rounded font-mono text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Bass Amplitude:</span>
              <strong className="text-black">{latestPayload.bassAmplitude} / 255</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vibration Pulse:</span>
              <strong className="text-emerald-700">{latestPayload.vibrationDurationMs} ms</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Frequency Band:</span>
              <strong className="text-purple-700 uppercase">{latestPayload.frequencyBand}</strong>
            </div>
          </div>

          {/* Intensity Slider */}
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between text-gray-600 font-bold">
              <span>Haptic Sensation Level</span>
              <span>{Math.round(hapticIntensityMultiplier * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.5"
              step="0.1"
              value={hapticIntensityMultiplier}
              onChange={(e) => setHapticIntensityMultiplier(Number(e.target.value))}
              className="w-full accent-black cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
