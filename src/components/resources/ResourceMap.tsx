// =============================================================================
// Component: ResourceMap
//  Issue: #3562 - Build an 'Interactive Campus "Safe Space" Directory'
//  Description: Renders a visual map or grid of campus safe spaces. Displays
//  persistent pins for all resources and provides detailed cards when a
//  specific resource is selected.
// =============================================================================

import React from 'react';
import { CampusResource, ResourceCategory } from '../../hooks/useCampusResources';

interface ResourceMapProps {
    resources: CampusResource[];
    selectedResource: CampusResource | null;
    onSelectResource: (resource: CampusResource | null) => void;
}

// Map categories to colors and icons for visual distinction
const CATEGORY_CONFIG: Record<ResourceCategory, { color: string; bgColor: string; icon: string }> = {
    mental_health: { color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/40', icon: '🧠' },
    lgbtq_center: { color: 'text-pink-700 dark:text-pink-400', bgColor: 'bg-pink-100 dark:bg-pink-900/40', icon: '🏳️‍🌈' },
    womens_center: { color: 'text-rose-700 dark:text-rose-400', bgColor: 'bg-rose-100 dark:bg-rose-900/40', icon: '♀️' },
    counseling: { color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/40', icon: '💬' },
    security: { color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/40', icon: '🛡️' },
    medical: { color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/40', icon: '🏥' },
    spiritual: { color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/40', icon: '🕊️' }
};

export const ResourceMap: React.FC<ResourceMapProps> = ({ resources, selectedResource, onSelectResource }) => {

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            {/* Map Area (Placeholder for actual map library integration) */}
            <div className="lg:col-span-2 bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 relative overflow-hidden">
                {/* Mock Map Background */}
                <div className="absolute inset-0 opacity-20 dark:opacity-10">
                    <svg className="w-full h-full" viewBox="0 0 800 600" fill="none" stroke="currentColor" strokeWidth="1">
                        <path d="M0 300 Q 200 200, 400 300 T 800 300" className="text-gray-400" />
                        <path d="M400 0 Q 300 200, 400 400 T 400 600" className="text-gray-400" />
                        <circle cx="400" cy="300" r="150" className="text-gray-400" strokeDasharray="5,5" />
                    </svg>
                </div>

                <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium bg-white/80 dark:bg-gray-800/80 px-4 py-2 rounded-full backdrop-blur-sm">
                        Interactive Map Integration (e.g., Mapbox/Leaflet) Goes Here
                    </p>
                </div>

                {/* Map Pins */}
                {resources.map((resource, idx) => {
                    const config = CATEGORY_CONFIG[resource.category];
                    // Mock positioning based on index for demonstration
                    const top = 20 + (idx * 15) % 60;
                    const left = 10 + (idx * 25) % 80;

                    return (
                        <button
                            key={resource.id}
                            onClick={() => onSelectResource(resource)}
                            className={`absolute w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-125 ${config.bgColor} ${selectedResource?.id === resource.id ? 'ring-4 ring-indigo-500 scale-125 z-10' : ''}`}
                            style={{ top: `${top}%`, left: `${left}%` }}
                            title={resource.name}
                        >
                            <span className="text-lg">{config.icon}</span>
                        </button>
                    );
                })}
            </div>

            {/* Resource Details Sidebar */}
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-y-auto custom-scrollbar p-4 space-y-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white sticky top-0 bg-white dark:bg-gray-800 pb-2 border-b border-gray-100 dark:border-gray-700">
                    {selectedResource ? 'Resource Details' : 'Select a Location'}
                </h3>

                {selectedResource ? (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${CATEGORY_CONFIG[selectedResource.category].bgColor}`}>
                                {CATEGORY_CONFIG[selectedResource.category].icon}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-lg">{selectedResource.name}</h4>
                                <p className={`text-xs font-bold uppercase tracking-wider ${CATEGORY_CONFIG[selectedResource.category].color}`}>
                                    {selectedResource.category.replace('_', ' ')}
                                </p>
                            </div>
                        </div>

                        {selectedResource.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                {selectedResource.description}
                            </p>
                        )}

                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>{selectedResource.building_name} {selectedResource.room_number && `(${selectedResource.room_number})`}</span>
                            </div>

                            {selectedResource.hours_of_operation && (
                                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{selectedResource.hours_of_operation}</span>
                                </div>
                            )}

                            {selectedResource.phone_number && (
                                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <a href={`tel:${selectedResource.phone_number}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 underline">
                                        {selectedResource.phone_number}
                                    </a>
                                </div>
                            )}
                        </div>

                        {selectedResource.is_confidential && (
                            <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs text-green-800 dark:text-green-300 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <span className="font-bold">100% Confidential Service</span>
                            </div>
                        )}

                        <button
                            onClick={() => onSelectResource(null)}
                            className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
                        >
                            Clear Selection
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                        <p>Click a pin on the map or select a category to view resource details.</p>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
        </div>
    );
};
