// =============================================================================
// Component: FloatingEmojis
// Issue: #3553 - Build a 'Live Event "Cheer/Applause" Button'
// Description: Renders the incoming cheer events as floating DOM elements.
// Uses CSS animations to float the emojis upwards with a slight bezier curve,
    // fading out after 3 seconds.Handles high volumes by rendering efficiently.
//  =============================================================================

import React, { useMemo } from 'react';
import { IncomingCheer } from '../../hooks/useLiveCheer';

interface FloatingEmojisProps {
    cheers: IncomingCheer[];
}

export const FloatingEmojis: React.FC<FloatingEmojisProps> = ({ cheers }) => {

    // Flatten the batched cheers into individual animated elements
    const animatedEmojis = useMemo(() => {
        const elements: { id: string; emoji: string; x: number; delay: number; duration: number }[] = [];

        cheers.forEach(cheer => {
            cheer.emojis.forEach((e, idx) => {
                elements.push({
                    id: `${cheer.id}-${idx}`,
                    emoji: e.emoji,
                    x: e.x_position,
                    // Stagger the start time slightly within the batch for a natural feel
                    delay: idx * 50,
                    // Randomize duration slightly (2.5s to 3.5s) for organic movement
                    duration: 2500 + Math.random() * 1000
                });
            });
        });

        return elements;
    }, [cheers]);

    return (
        <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
            {animatedEmojis.map(item => (
                <div
                    key={item.id}
                    className="absolute bottom-0 text-4xl md:text-5xl animate-float-up"
                    style={{
                        left: `${item.x}%`,
                        animationDuration: `${item.duration}ms`,
                        animationDelay: `${item.delay}ms`,
                        // Add a slight random horizontal drift via CSS variables
                        '// drift': `${(Math.random() - 0.5) * 100}px`
                    } as React.CSSProperties}
                >
                    {item.emoji}
                </div>
            ))}

            <style>{`
        @keyframes float-up {
          0% {
            transform: translateY(0) translateX(0) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translateY(-10vh) translateX(calc(var(// drift) * 0.2)) scale(1);
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) translateX(var(// drift)) scale(1.2);
            opacity: 0;
          }
        }
        
        .animate-float-up {
          animation-name: float-up;
          animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
          animation-fill-mode: forwards;
          will-change: transform, opacity;
        }
      `}</style>
        </div>
    );
};
