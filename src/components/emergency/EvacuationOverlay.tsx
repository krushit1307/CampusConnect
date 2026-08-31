'use client';

import { EvacuationRoute } from '@/types/venue';

interface EvacuationOverlayProps {
    routes: EvacuationRoute[];
    isActive: boolean;
}

export default function EvacuationOverlay({ routes, isActive }: EvacuationOverlayProps) {
    if (!isActive || routes.length === 0) {
        return null;
    }

    return (
        <div className="absolute inset-0 z-40 pointer-events-none">
            <div className="absolute inset-0 bg-red-900/10 dark:bg-red-900/30 animate-pulse" />
            <svg className="absolute inset-0 w-full h-full">
                {routes.map((route) => (
                    <g key={route.id}>
                        {/* Glow effect */}
                        <polyline
                            points={route.points.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={route.width + 4}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="animate-pulse opacity-70"
                        />
                        {/* Main line */}
                        <polyline
                            points={route.points.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth={route.width}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {/* Arrowheads at the end of each segment */}
                        {route.points.slice(0, -1).map((point, index) => {
                            const nextPoint = route.points[index + 1];
                            const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) * (180 / Math.PI);
                            return (
                                <g key={`arrow-${index}`} transform={`translate(${point.x}, ${point.y}) rotate(${angle})`}>
                                    <polygon points="0,-6 12,0 0,6" fill="#dc2626" />
                                </g>
                            );
                        })}
                        {/* Route Label */}
                        <text
                            x={route.points[0].x + 10}
                            y={route.points[0].y - 10}
                            fill="#dc2626"
                            fontSize="14"
                            fontWeight="bold"
                            className="drop-shadow-md"
                        >
                            {route.name}
                        </text>
                    </g>
                ))}
            </svg>
            <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg animate-bounce">
                🚨 EMERGENCY EVACUATION ROUTE ACTIVE 🚨
            </div>
        </div>
    );
}
