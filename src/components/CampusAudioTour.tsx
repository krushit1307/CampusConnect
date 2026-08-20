import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface Milestone {
  id: string;
  title: string;
  audio_file_url: string;
  trigger_radius: number;
  distance_meters: number;
}

export default function CampusAudioTour() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
  const [nearbyNodes, setNearbyNodes] = useState<Milestone[]>([]);
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string>('');

  // Web Audio API References to prevent execution clipping on state changes
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const activePlayingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isTourActive) return;

    // 1. Initialize High-Accuracy Browser Geolocation Tracker
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lon: longitude });
        evaluateProximityMetrics(longitude, latitude);
      },
      (err) => {
        setErrorText(`GPS error: ${err.message}. Enable accurate location tracking.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTourActive]);

  // 2. Evaluate proximity to historical nodes
  const evaluateProximityMetrics = async (lon: number, lat: number) => {
    try {
      const { data, error } = await supabase.rpc('get_nearby_milestones', {
        user_lon: lon,
        user_lat: lat,
        max_distance_meters: 150, // Poll nodes within a 150m walking bracket
      });

      if (error || !data) return;

      const items = data as Milestone[];
      setNearbyNodes(items);

      // Find the first milestone where the user is inside the trigger radius
      const targetNode = items.find((node) => node.distance_meters <= node.trigger_radius);

      if (targetNode) {
        if (activePlayingIdRef.current !== targetNode.id) {
          triggerSpatialAudioStory(targetNode);
        }
      } else {
        // Fade out immediately if the user leaves all trigger zones
        fadeOutActiveAudio();
      }
    } catch (err) {
      console.error('Proximity evaluation failure:', err);
    }
  };

  // 3. Web Audio API Core Engine: Load and smoothly fade in media files
  const triggerSpatialAudioStory = async (node: Milestone) => {
    try {
      fadeOutActiveAudio(); // Clear existing loops safely
      
      setActiveMilestone(node);
      activePlayingIdRef.current = node.id;

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;

      // Fetch the target audio file binary payload
      const response = await fetch(node.audio_file_url);
      const arrayBuffer = await response.arrayBuffer();
      
      // Decode audio tracks into buffers asynchronously
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      audioBufferRef.current = decodedBuffer;

      // Construct Node Topology: Source -> Gain Node (Volume) -> Output Speakers
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      
      source.buffer = decodedBuffer;
      source.loop = true; // Loop audio while the user stays inside the historical node footprint

      // Safe Linear Volume Fade-In Sequence over 2.5 seconds to build immersion
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5);

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      source.start(0);

      // Pin handles to active references
      sourceNodeRef.current = source;
      gainNodeRef.current = gainNode;
    } catch (err) {
      console.error('Web Audio Engine failed to play track:', err);
    }
  };

  const fadeOutActiveAudio = () => {
    const ctx = audioContextRef.current;
    const gain = gainNodeRef.current;
    const source = sourceNodeRef.current;

    if (ctx && gain && source && activePlayingIdRef.current) {
      const fadeDuration = 2.0; // Smooth 2-second fade-out when stepping away
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeDuration);
      
      setTimeout(() => {
        try { source.stop(); } catch (e) {}
      }, fadeDuration * 1000);

      activePlayingIdRef.current = null;
      setActiveMilestone(null);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-slate-950 border border-slate-800 text-white rounded-2xl shadow-xl">
      <div className="border-b border-slate-800 pb-4 mb-6 text-center">
        <h2 className="text-lg font-black tracking-wide text-indigo-400">Interactive Campus History Walk</h2>
        <p className="text-xs text-slate-400 mt-1">Walk around campus to explore historical nodes and milestones in real-time.</p>
      </div>

      {!isTourActive ? (
        <button
          onClick={() => setIsTourActive(true)}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest py-3 rounded-xl transition shadow-md"
        >
          🚶 Start Audio Experience
        </button>
      ) : (
        <div className="space-y-6">
          {/* Active Node Viewport */}
          <div className="p-5 rounded-xl border border-indigo-900 bg-indigo-950/30 text-center relative overflow-hidden">
            {activeMilestone ? (
              <div className="animate-pulse">
                <span className="text-[10px] bg-indigo-500 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  🎧 Now Playing
                </span>
                <h3 className="text-xl font-bold mt-2 text-indigo-200">{activeMilestone.title}</h3>
                <p className="text-xs text-indigo-400 mt-1">You are inside the trigger zone ({Math.round(activeMilestone.distance_meters)}m away)</p>
              </div>
            ) : (
              <div>
                <span className="text-[10px] bg-slate-800 text-slate-400 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  📡 Scanning Space
                </span>
                <p className="text-sm text-slate-400 mt-3 font-medium">Walk toward a historical landmark to begin the audio experience.</p>
              </div>
            )}
          </div>

          {/* Minimalist Upcoming Nodes Tracker List */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Nearby Historical Nodes</h4>
            <div className="space-y-2">
              {nearbyNodes.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Searching for satellite nodes within 150 meters...</p>
              ) : (
                nearbyNodes.map((node) => (
                  <div key={node.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-xs font-bold text-slate-200 line-clamp-1">{node.title}</span>
                    <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                      {Math.round(node.distance_meters)}m away
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {errorText && <p className="mt-4 text-xs font-semibold text-red-400 text-center">⚠️ {errorText}</p>}
    </div>
  );
}
