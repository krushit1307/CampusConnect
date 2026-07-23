import React from "react";
import { Link } from "react-router-dom";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-brand-yellow-bg-light flex flex-col items-center justify-center p-6 text-slate-900 font-sans select-none selection:bg-yellow-300">
      {/* Neubrutalist Wrapper Container */}
      <div className="max-w-xl w-full text-center bg-white border-4 border-black p-8 sm:p-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none transform transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
        {/* Animated Custom SVG Neubrutalist Illustration */}
        <div className="w-full flex justify-center mb-8 relative">
          <svg
            className="w-48 h-48 sm:w-64 sm:h-64 filter drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Neubrutalist 404 Illustration representing a broken digital terminal frame"
          >
            {/* Background Geometric Accent Grid Box */}
            <rect
              x="15"
              y="25"
              width="150"
              height="150"
              fill="#FFDE4D"
              stroke="black"
              strokeWidth="4"
            />

            {/* Terminal Window Top Bar Header */}
            <rect
              x="35"
              y="45"
              width="130"
              height="24"
              fill="#FF6B6B"
              stroke="black"
              strokeWidth="4"
            />
            <circle cx="50" cy="57" r="5" fill="black" />
            <circle cx="65" cy="57" r="5" fill="black" />

            {/* Inner Error Code Content Blocks */}
            <rect
              x="35"
              y="65"
              width="130"
              height="90"
              fill="white"
              stroke="black"
              strokeWidth="4"
            />

            {/* Floating '404' Text Block Layer */}
            <g className="animate-wiggle">
              <rect
                x="55"
                y="85"
                width="90"
                height="45"
                fill="#4D96FF"
                stroke="black"
                strokeWidth="4"
                strokeLinejoin="miter"
              />
              <text
                x="100"
                y="117"
                fill="black"
                fontFamily="Impact, sans-serif"
                fontSize="32"
                fontWeight="900"
                textAnchor="middle"
              >
                404
              </text>
            </g>

            {/* Cross Geometric Floating Accents */}
            <path
              className="animate-[bounce_2.5s_infinite] origin-center"
              d="M165 60 L175 70 M175 60 L165 70"
              stroke="black"
              strokeWidth="4"
              strokeLinecap="square"
            />
            <path
              className="animate-wiggle origin-center"
              d="M20 140 L30 150 M30 140 L20 150"
              stroke="black"
              strokeWidth="4"
              strokeLinecap="square"
            />
          </svg>
        </div>

        {/* Subtle Bouncing Heading Text Section */}
        <h1 className="mb-4 inline-block animate-subtle-bounce border-b-4 border-black pb-4 text-4xl font-black uppercase tracking-tight sm:text-5xl">
          Page Not Found
        </h1>

        <p className="text-base sm:text-lg font-bold text-slate-700 max-w-md mx-auto mb-8 leading-relaxed">
          The campus path you're looking for doesn't exist, was relocated, or is hiding out until
          finals week is over.
        </p>

        {/* Neubrutalist Primary Navigation Button */}
        <Link
          to="/dashboard"
          className="inline-block px-8 py-4 bg-brand-red-light border-4 border-black font-black uppercase tracking-wider text-sm transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1"
        >
          Back to Campus Dashboard
        </Link>
      </div>
    </div>
  );
};
