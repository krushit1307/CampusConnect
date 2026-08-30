'use client';

import { FacilityNodeType } from '@/types/venue';

interface FacilitiesToolkitProps {
    onDragStart: (type: FacilityNodeType) => void;
}

export default function FacilitiesToolkit({ onDragStart }: FacilitiesToolkitProps) {
    const facilities: { type: FacilityNodeType; label: string; icon: string; color: string }[] = [
        { type: 'wheelchair_ramp', label: 'Wheelchair Ramp', icon: '♿', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
        { type: 'elevator', label: 'Elevator', icon: '🛗', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
        { type: 'accessible_restroom', label: 'Accessible Restroom', icon: '🚻', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
        { type: 'emergency_exit', label: 'Emergency Exit', icon: '🚪', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
    ];

    return (
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col h-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Facilities Toolkit
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Drag and drop accessibility nodes onto the canvas. Nodes will automatically snap to the grid.
            </p>

            <div className="space-y-3 flex-1 overflow-y-auto">
                {facilities.map((facility) => (
                    <div
                        key={facility.type}
                        draggable
                        onDragStart={() => onDragStart(facility.type)}
                        className={`
              flex items-center space-x-3 p-3 rounded-lg border-2 border-dashed 
              border-gray-300 dark:border-gray-600 cursor-grab active:cursor-grabbing
              hover:border-blue-500 dark:hover:border-blue-400 transition-colors
              ${facility.color}
            `}
                    >
                        <span className="text-2xl">{facility.icon}</span>
                        <span className="font-medium text-sm">{facility.label}</span>
                    </div>
                ))}
            </div>

            <div className="mt-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    <strong>Tip:</strong> Click on a placed node and use the rotation handles to adjust its orientation.
                </p>
            </div>
        </div>
    );
}
