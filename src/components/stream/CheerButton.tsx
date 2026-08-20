// =============================================================================
// Component: CheerButton
//  Issue: #3553 - Build a 'Live Event "Cheer/Applause" Button'
//  Description: The massive, floating '👏' button overlaid on the video player.
//  Captures the X-axis position of the click to determine where the emoji
//  should spawn on the screen, and triggers the broadcast function.
// =============================================================================

import React, { useState } from 'react';

interface CheerButtonProps {
    onCheer: (emoji: string, xPosition: number) => void;
}

// Available emojis for the user to cycle through
const EMOJI_OPTIONS = ['👏', '🔥', '🎉', '❤️', '🚀', '💯'];

export const CheerButton: React.FC<CheerButtonProps> = ({ onCheer }) => {
    const [selectedEmoji, setSelectedEmoji] = useState('👏');
    const [showPicker, setShowPicker] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        // Calculate the X position relative to the viewport (0 to 100%)
        const rect = e.currentTarget.getBoundingClientRect();
        const xPosition = (e.clientX / window.innerWidth) * 100;

        onCheer(selectedEmoji, xPosition);

        // Trigger button press animation
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 200);
    };

    return (
        <div className="relative inline-block">
            {/* Emoji Picker Dropdown */}
            {showPicker && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-white dark:bg-gray-800 rounded-full shadow-xl border border-gray-200 dark:border-gray-700 p-2 flex gap-1 animate-fade-in-up z-20">
                    {EMOJI_OPTIONS.map(emoji => (
                        <button
                            key={emoji}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmoji(emoji);
                                setShowPicker(false);
                            }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${selectedEmoji === emoji ? 'bg-indigo-100 dark:bg-indigo-900/40' : ''
                                }`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {/* Main Cheer Button */}
            <button
                onClick={handleClick}
                onContextMenu={(e) => {
                    e.preventDefault();
                    setShowPicker(!showPicker);
                }}
                className={`relative w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-2xl flex items-center justify-center text-4xl hover:scale-110 active:scale-95 transition-all duration-150 group ${isAnimating ? 'scale-90' : ''
                    }`}
                title="Click to cheer! Right-click to change emoji."
            >
                <span className={`transition-transform duration-150 ${isAnimating ? 'scale-125' : ''}`}>
                    {selectedEmoji}
                </span>

                {/* Ripple effect on click */}
                {isAnimating && (
                    <span className="absolute inset-0 rounded-full bg-white/30 animate-ping"></span>
                )}

                {/* Tooltip */}
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Applaud!
                </span>
            </button>

            <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.2s ease-out forwards;
        }
      `}</style>
        </div>
    );
};
