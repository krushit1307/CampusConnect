import React, { useState } from 'react';
import { EmployerBooth } from '@/types/careerFair';
import { MapPin, Navigation, Sparkles, Building2, Users } from 'lucide-react';

interface CareerFairVenueMapProps {
  booths: EmployerBooth[];
  selectedBooth: EmployerBooth | null;
  onSelectBooth: (booth: EmployerBooth) => void;
  showOptimalPath: boolean;
  onTogglePath: () => void;
}

export function CareerFairVenueMap({
  booths,
  selectedBooth,
  onSelectBooth,
  showOptimalPath,
  onTogglePath,
}: CareerFairVenueMapProps) {
  // Sort high match booths for the optimal path (e.g. matchScore > 75)
  const topMatchedBooths = booths
    .filter((b) => (b.matchScore || 0) >= 75)
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  const gridSize = 10; // 10x10 venue layout grid

  return (
    <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-4">
      {/* Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h2 className="text-xl font-display font-black text-black flex items-center gap-2">
            <Building2 size={22} className="text-blue-600" /> Interactive Venue Floorplan
          </h2>
          <p className="font-mono text-xs text-gray-600">
            Grand Ballroom • Click booths to view matching requirements and join live virtual queues.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePath}
            className={`px-3.5 py-2 font-mono text-xs font-black uppercase flex items-center gap-1.5 border-2 border-black rounded transition-all ${
              showOptimalPath
                ? 'bg-lime text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'bg-white hover:bg-gray-100 text-gray-700'
            }`}
          >
            <Navigation size={14} />
            {showOptimalPath ? 'Hide AI Path' : 'Generate Optimal Route (A*)'}
          </button>
        </div>
      </div>

      {/* Interactive Map Floor */}
      <div className="relative w-full aspect-16/10 bg-slate-50 border-2 border-black rounded-lg overflow-hidden p-4">
        {/* Floor Grid Lines */}
        <div
          className="absolute inset-0 grid grid-cols-10 grid-rows-10 pointer-events-none opacity-20"
          style={{
            backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
            backgroundSize: '10% 10%',
          }}
        />

        {/* Entrance Marker */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-1 rounded-t font-mono text-xs font-bold uppercase tracking-wider z-10">
          ▼ Main Entrance
        </div>

        {/* Optimal Path SVG Overlay */}
        {showOptimalPath && topMatchedBooths.length > 1 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            <defs>
              <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <polyline
              points={topMatchedBooths
                .map((b) => `${b.x * 9 + 5.5}%,${b.y * 9 + 5.5}%`)
                .join(' ')}
              fill="none"
              stroke="url(#pathGradient)"
              strokeWidth="4"
              strokeDasharray="8 6"
              className="animate-pulse"
            />
          </svg>
        )}

        {/* Booth Items */}
        <div className="relative w-full h-full">
          {booths.map((booth) => {
            const isSelected = selectedBooth?.id === booth.id;
            const isHighMatch = (booth.matchScore || 0) >= 80;
            const tierBorder =
              booth.sponsorTier === 'platinum'
                ? 'border-purple-600 bg-purple-50'
                : booth.sponsorTier === 'gold'
                ? 'border-amber-500 bg-amber-50'
                : 'border-black bg-white';

            return (
              <div
                key={booth.id}
                onClick={() => onSelectBooth(booth)}
                style={{
                  left: `${booth.x * 9}%`,
                  top: `${booth.y * 9}%`,
                }}
                className={`absolute w-24 h-20 border-2 rounded-lg p-2 cursor-pointer transition-all duration-200 flex flex-col justify-between z-20 ${tierBorder} ${
                  isSelected
                    ? 'ring-4 ring-lime scale-110 shadow-lg'
                    : 'hover:scale-105 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-[10px] text-gray-500">
                    #{booth.boothNumber}
                  </span>
                  {booth.matchScore && (
                    <span
                      className={`font-mono text-[9px] px-1 rounded font-black ${
                        isHighMatch
                          ? 'bg-lime text-black border border-black'
                          : 'bg-slate-200 text-gray-700'
                      }`}
                    >
                      {booth.matchScore}%
                    </span>
                  )}
                </div>

                <div className="font-display font-black text-xs text-black line-clamp-1">
                  {booth.name}
                </div>

                <div className="flex items-center justify-between text-[9px] font-mono text-gray-500">
                  <span className="flex items-center gap-0.5">
                    <Users size={10} /> {booth.virtualQueueLength}
                  </span>
                  <span>{booth.estimatedWaitMinutes}m wait</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
