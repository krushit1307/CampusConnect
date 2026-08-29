import React, { useState, useEffect, useRef } from 'react';
import { TranscriptSegment, TranscriptWord } from '@/types/transcription';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Search,
  Volume2,
  Sliders,
  Sparkles,
  UserCheck,
  Clock,
} from 'lucide-react';

interface InteractiveAudioTranscriptProps {
  segments: TranscriptSegment[];
  durationSeconds: number;
  onTimeSeek?: (seconds: number) => void;
}

export function InteractiveAudioTranscript({
  segments,
  durationSeconds,
  onTimeSeek,
}: InteractiveAudioTranscriptProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const intervalRef = useRef<number | null>(null);

  // Playback timer simulation
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= durationSeconds) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.25 * playbackSpeed;
        });
      }, 250);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, playbackSpeed, durationSeconds]);

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    onTimeSeek?.(time);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-white border-2 border-black rounded-lg overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      {/* Audio Control Bar */}
      <div className="p-4 border-b-2 border-black bg-slate-50 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSeek(Math.max(0, currentTime - 5))}
              className="p-2 border border-black rounded bg-white hover:bg-slate-100"
              title="Rewind 5s"
            >
              <RotateCcw size={16} />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2.5 bg-lime hover:bg-lime/90 border-2 border-black rounded-full font-mono text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-transform"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
            </button>

            <button
              onClick={() => handleSeek(Math.min(durationSeconds, currentTime + 5))}
              className="p-2 border border-black rounded bg-white hover:bg-slate-100"
              title="Forward 5s"
            >
              <RotateCw size={16} />
            </button>

            <div className="font-mono text-xs font-bold text-gray-700 ml-2">
              {formatTime(currentTime)} / {formatTime(durationSeconds)}
            </div>
          </div>

          {/* Speed Selector & Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transcript..."
                className="pl-8 pr-3 py-1 border-2 border-black rounded font-mono text-xs bg-white"
              />
            </div>

            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="px-2 py-1 border-2 border-black rounded font-mono text-xs bg-white font-bold"
            >
              <option value={0.75}>0.75x</option>
              <option value={1}>1.0x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
            </select>
          </div>
        </div>

        {/* Scrubber Slider */}
        <div className="w-full">
          <input
            type="range"
            min={0}
            max={durationSeconds}
            step={0.1}
            value={currentTime}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="w-full accent-black cursor-pointer"
          />
        </div>
      </div>

      {/* Transcript Scrolling Body */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6 max-h-[520px]">
        {segments.map((segment) => {
          const isSegmentActive =
            currentTime >= segment.startTime && currentTime <= segment.endTime;
          const isQuestion = segment.speaker.toLowerCase().includes('student');

          return (
            <div
              key={segment.id}
              className={`p-4 border-2 border-black rounded-lg transition-colors duration-150 ${
                isSegmentActive
                  ? 'bg-amber-50/80 border-amber-500 shadow-[2px_2px_0px_0px_rgba(245,158,11,1)]'
                  : 'bg-white hover:bg-slate-50/50'
              }`}
            >
              {/* Speaker Badge & Timestamp */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-xs font-bold border ${
                    isQuestion
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-purple-100 text-purple-800 border-purple-300'
                  }`}
                >
                  <UserCheck size={12} /> {segment.speaker}
                </span>

                <button
                  onClick={() => handleSeek(segment.startTime)}
                  className="font-mono text-xs text-gray-500 hover:text-black font-bold flex items-center gap-1"
                >
                  <Clock size={12} /> {formatTime(segment.startTime)}
                </button>
              </div>

              {/* Synchronized Word Highlighting */}
              <p className="font-mono text-sm leading-relaxed text-gray-800">
                {segment.words.map((w, idx) => {
                  const isWordActive =
                    currentTime >= w.start && currentTime <= w.end;
                  const isSearchMatch =
                    searchQuery &&
                    w.word.toLowerCase().includes(searchQuery.toLowerCase());

                  return (
                    <span
                      key={idx}
                      onClick={() => handleSeek(w.start)}
                      className={`cursor-pointer px-0.5 rounded transition-all ${
                        isWordActive
                          ? 'bg-lime text-black font-bold ring-2 ring-black'
                          : isSearchMatch
                          ? 'bg-yellow-200 underline font-bold'
                          : 'hover:bg-gray-200'
                      }`}
                    >
                      {w.word}{' '}
                    </span>
                  );
                })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
