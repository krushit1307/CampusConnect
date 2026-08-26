// =============================================================================
// Component: SentimentGauge
// Issue: #3230 - Implement 'Live Audience Sentiment Analysis'
// Description: A speedometer-style SVG gauge that visually represents the 
// rolling average sentiment of the live audience. Smoothly animates the 
// needle between "Confused/Negative" (Red), "Neutral" (Yellow), and 
// "Engaged/Positive" (Green). Fades out when the chat is silent.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { SentimentState } from '../../hooks/useLiveSentiment';

interface SentimentGaugeProps {
    state: SentimentState;
}

export const SentimentGauge: React.FC<SentimentGaugeProps> = ({ state }) => {
    // Map score (-5 to +5) to angle (-90 to +90 degrees)
    // -5 = -90deg (Left/Red), 0 = 0deg (Center/Yellow), +5 = +90deg (Right/Green)
    const [needleAngle, setNeedleAngle] = useState(0);

    useEffect(() => {
        const angle = (state.currentScore / 5) * 90;
        setNeedleAngle(angle);
    }, [state.currentScore]);

    const isSilent = state.engagementLevel === 'silent';

    const getStatusLabel = () => {
        if (isSilent) return 'Low Engagement / Silent';
        if (state.currentScore >= 2.5) return 'Highly Engaged';
        if (state.currentScore >= 1) return 'Positive';
        if (state.currentScore > -1) return 'Neutral / Listening';
        if (state.currentScore > -2.5) return 'Confused';
        return 'Negative / Frustrated';
    };

    const getStatusColor = () => {
        if (isSilent) return 'text-gray-400 dark:text-gray-500';
        if (state.currentScore >= 1) return 'text-green-600 dark:text-green-400';
        if (state.currentScore > -1) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm transition-opacity duration-500 ${isSilent ? 'opacity-60' : 'opacity-100'}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Audience Sentiment</h3>
                <span className={`text-sm font-bold uppercase tracking-wider ${getStatusColor()}`}>
                    {getStatusLabel()}
                </span>
            </div>

            <div className="relative w-full max-w-xs mx-auto aspect-[2/1]">
                <svg viewBox="0 0 200 100" className="w-full h-full overflow-visible">
                    {/* Gauge Background Arc */}
                    <defs>
                        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#EF4444" />   {/* Red */}
                            <stop offset="50%" stopColor="#EAB308" />  {/* Yellow */}
                            <stop offset="100%" stopColor="#22C55E" /> {/* Green */}
                        </linearGradient>
                    </defs>

                    {/* Outer Track */}
                    <path
                        d="M 20 90 A 80 80 0 0 1 180 90"
                        fill="none"
                        stroke="url(#gaugeGradient)"
                        strokeWidth="12"
                        strokeLinecap="round"
                        opacity={isSilent ? 0.3 : 1}
                    />

                    {/* Tick Marks */}
                    {[-90, -45, 0, 45, 90].map((angle, i) => {
                        const rad = (angle - 90) * (Math.PI / 180);
                        const x1 = 100 + 65 * Math.cos(rad);
                        const y1 = 90 + 65 * Math.sin(rad);
                        const x2 = 100 + 75 * Math.cos(rad);
                        const y2 = 90 + 75 * Math.sin(rad);
                        return (
                            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9CA3AF" strokeWidth="2" />
                        );
                    })}

                    {/* Needle */}
                    <g
                        transform={`rotate(${needleAngle}, 100, 90)`}
                        className="transition-transform duration-700 ease-out"
                    >
                        <line
                            x1="100" y1="90" x2="100" y2="25"
                            stroke="#1F2937"
                            strokeWidth="3"
                            strokeLinecap="round"
                            className="dark:stroke-gray-200"
                        />
                        <circle cx="100" cy="90" r="6" fill="#1F2937" className="dark:fill-gray-200" />
                    </g>
                </svg>
            </div>

            {/* Metrics Footer */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="text-center">
                    <p className="text-2xl font-black text-gray-900 dark:text-white">
                        {state.currentScore.toFixed(1)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">
                        Score
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-2xl font-black text-gray-900 dark:text-white">
                        {state.messageCount}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">
                        Messages
                    </p>
                </div>
                <div className="text-center">
                    <p className={`text-2xl font-black capitalize ${state.trend === 'improving' ? 'text-green-600 dark:text-green-400' :
                            state.trend === 'declining' ? 'text-red-600 dark:text-red-400' :
                                'text-gray-900 dark:text-white'
                        }`}>
                        {state.trend === 'improving' ? '↑' : state.trend === 'declining' ? '↓' : '→'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">
                        Trend
                    </p>
                </div>
            </div>
        </div>
    );
};
