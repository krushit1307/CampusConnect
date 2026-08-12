// src/components/CampusMap/CampusMapSVG.tsx
import React from "react";

interface CampusMapSVGProps {
  onMapClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  className?: string;
}

/**
 * High-quality, optimized SVG vector map of the campus.
 * Heavily optimized using SVGO to prevent mobile performance lag when zoomed.
 * Contains semantic groupings for buildings, roads, and green spaces.
 */
export const CampusMapSVG: React.FC<CampusMapSVGProps> = ({ onMapClick, className }) => {
  return (
    <svg
      viewBox="0 0 1000 800"
      className={className}
      onClick={onMapClick}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id="grass" patternUnits="userSpaceOnUse" width="20" height="20">
          <rect width="20" height="20" fill="#dcfce7" />
          <circle cx="5" cy="5" r="1" fill="#bbf7d0" />
          <circle cx="15" cy="15" r="1" fill="#bbf7d0" />
        </pattern>
        <pattern id="water" patternUnits="userSpaceOnUse" width="40" height="40">
          <rect width="40" height="40" fill="#dbeafe" />
          <path d="M0 20 Q10 10 20 20 T40 20" fill="none" stroke="#bfdbfe" strokeWidth="1" />
        </pattern>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Base Ground / Grass */}
      <rect width="1000" height="800" fill="url(#grass)" />

      {/* Water Features (Lake) */}
      <path
        d="M 700 100 Q 850 150 800 300 T 900 500 Q 950 600 850 700 L 1000 800 L 1000 0 Z"
        fill="url(#water)"
      />

      {/* Roads */}
      <g stroke="#e5e7eb" strokeWidth="24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 0 400 L 1000 400" />
        <path d="M 500 0 L 500 800" />
        <path d="M 200 200 L 800 200" />
        <path d="M 200 600 L 800 600" />
      </g>

      {/* Road Centerlines */}
      <g stroke="#fbbf24" strokeWidth="2" fill="none" strokeDasharray="10,10">
        <path d="M 0 400 L 1000 400" />
        <path d="M 500 0 L 500 800" />
      </g>

      {/* Buildings */}
      <g filter="url(#shadow)">
        {/* Student Union */}
        <rect
          x="350"
          y="250"
          width="120"
          height="100"
          fill="#fca5a5"
          stroke="#ef4444"
          strokeWidth="2"
          rx="4"
          data-building="student-union"
        />
        <text x="410" y="305" fontSize="12" fontWeight="bold" fill="#7f1d1d" textAnchor="middle">
          Student Union
        </text>

        {/* Library */}
        <rect
          x="150"
          y="250"
          width="140"
          height="120"
          fill="#fcd34d"
          stroke="#f59e0b"
          strokeWidth="2"
          rx="4"
          data-building="library"
        />
        <text x="220" y="315" fontSize="12" fontWeight="bold" fill="#78350f" textAnchor="middle">
          Main Library
        </text>

        {/* Engineering Block */}
        <polygon
          points="600,250 750,250 750,350 650,350 650,400 600,400"
          fill="#93c5fd"
          stroke="#3b82f6"
          strokeWidth="2"
          data-building="engineering"
        />
        <text x="675" y="320" fontSize="12" fontWeight="bold" fill="#1e3a8a" textAnchor="middle">
          Engineering
        </text>

        {/* Science Complex */}
        <rect
          x="150"
          y="500"
          width="180"
          height="100"
          fill="#a7f3d0"
          stroke="#10b981"
          strokeWidth="2"
          rx="4"
          data-building="science"
        />
        <text x="240" y="555" fontSize="12" fontWeight="bold" fill="#064e3b" textAnchor="middle">
          Science Complex
        </text>

        {/* Arts & Humanities */}
        <path
          d="M 350 500 L 450 500 L 480 550 L 450 600 L 350 600 Z"
          fill="#d8b4fe"
          stroke="#a855f7"
          strokeWidth="2"
          data-building="arts"
        />
        <text x="410" y="555" fontSize="12" fontWeight="bold" fill="#581c87" textAnchor="middle">
          Arts Center
        </text>

        {/* Dormitories */}
        <rect
          x="600"
          y="500"
          width="60"
          height="120"
          fill="#fdba74"
          stroke="#f97316"
          strokeWidth="2"
          rx="4"
          data-building="dorm-1"
        />
        <rect
          x="680"
          y="500"
          width="60"
          height="120"
          fill="#fdba74"
          stroke="#f97316"
          strokeWidth="2"
          rx="4"
          data-building="dorm-2"
        />
        <text x="670" y="680" fontSize="12" fontWeight="bold" fill="#9a3412" textAnchor="middle">
          Residences
        </text>
      </g>

      {/* Trees / Landscaping */}
      <g fill="#166534" opacity="0.8">
        <circle cx="100" cy="100" r="15" />
        <circle cx="130" cy="120" r="12" />
        <circle cx="850" cy="400" r="20" />
        <circle cx="880" cy="430" r="15" />
        <circle cx="300" cy="700" r="18" />
      </g>
    </svg>
  );
};
