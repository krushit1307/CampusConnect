'use client';

import { useState, useRef } from 'react';
import { Point, EvacuationRoute } from '@/types/venue';

interface EvacuationPathToolProps {
    onSave: (route: Omit<EvacuationRoute, 'id'>) => void;
    onCancel: () => void;
}

export default function EvacuationPathTool({ onSave, onCancel }: EvacuationPathToolProps) {
    const [points, setPoints] = useState<Point[]>([]);
    const [routeName, setRouteName] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / 20) * 20; // Snap to 20px grid
        const y = Math.round((e.clientY - rect.top) / 20) * 20;

        setPoints(prev => [...prev, { x, y }]);
    };

    const handleSave = () => {
        if (points.length < 2 || !routeName.trim()) {
            alert('Please provide a route name and at least 2 points.');
            return;
        }

        onSave({
            name: routeName,
            points,
            color: '#ef4444', // Bright red for evacuation
            width: 4,
        });
    };

    const handleUndo = () => {
        setPoints(prev => prev.slice(0, -1));
    };

    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-2xl border-2 border-red-500 dark:border-red-600 z-50">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Draw Evacuation Route
            </h3>

            <div className="space-y-3 mb-4">
                <input
                    type="text"
                    placeholder="Route Name (e.g., Main Hall to Exit A)"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Points placed: {points.length}. Click on the canvas to add points.
                </p>
            </div>

            <div className="flex space-x-2">
                <button
                    onClick={handleUndo}
                    disabled={points.length === 0}
                    className="flex-1 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                    Undo Point
                </button>
                <button
                    onClick={handleSave}
                    disabled={points.length < 2}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                    Save Route
                </button>
                <button
                    onClick={onCancel}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
