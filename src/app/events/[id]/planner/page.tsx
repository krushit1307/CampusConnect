'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { BlueLightPhone, EventGeofence, SafetyValidationResult } from '@/types/safety';
import BlueLightLayer from '@/components/map/BlueLightLayer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Event Planner page with integrated Campus Safety Blue Light Phone Map Layer.
 * Allows organizers to visualize emergency infrastructure and validate safety compliance.
 */
export default function EventPlannerPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [phones, setPhones] = useState<BlueLightPhone[]>([]);
    const [showBlueLights, setShowBlueLights] = useState(true);
    const [validationResult, setValidationResult] = useState<SafetyValidationResult | null>(null);
    const [isNightTime, setIsNightTime] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Mock geofence for demonstration
    const mockGeofence: EventGeofence = {
        eventId,
        polygon: [[[-73.985, 40.748], [-73.985, 40.758], [-73.975, 40.758], [-73.975, 40.748], [-73.985, 40.748]]],
        center: [-73.980, 40.753],
        radiusFeet: 1000,
    };

    useEffect(() => {
        async function fetchData() {
            try {
                // In production, fetch from Campus Security database
                // const { data } = await supabase.from('blue_light_phones').select('*');
                const mockPhones: BlueLightPhone[] = [
                    {
                        id: 'bl-001',
                        name: 'North Quad Entrance',
                        coordinates: [-73.978, 40.755],
                        status: 'active',
                        lastChecked: new Date().toISOString(),
                    },
                    {
                        id: 'bl-002',
                        name: 'Remote Parking Lot B',
                        coordinates: [-73.990, 40.760],
                        status: 'maintenance',
                        lastChecked: new Date(Date.now() - 86400000 * 5).toISOString(),
                    },
                ];
                setPhones(mockPhones);

                // Initial validation
                await validateSafety(mockGeofence, isNightTime);
            } catch (error) {
                console.error('Failed to load safety data:', error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [eventId]);

    const validateSafety = async (geofence: EventGeofence, nightTime: boolean) => {
        try {
            const response = await fetch(`/api/events/${eventId}/validate-safety`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId,
                    geofence,
                    isNightTimeEvent: nightTime,
                }),
            });
            const data = await response.json();
            if (response.ok) {
                setValidationResult(data.result);
            }
        } catch (error) {
            console.error('Safety validation failed:', error);
        }
    };

    const handleNightTimeToggle = (checked: boolean) => {
        setIsNightTime(checked);
        validateSafety(mockGeofence, checked);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Event Planner: Safety Layer</h1>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isNightTime}
                                onChange={(e) => handleNightTimeToggle(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Night-time Event</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showBlueLights}
                                onChange={(e) => setShowBlueLights(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Blue Lights</span>
                        </label>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col md:flex-row">
                {/* Map Canvas Area */}
                <div className="flex-1 relative bg-gray-200 dark:bg-gray-800 min-h-[500px] md:min-h-0 overflow-hidden">
                    {/* Mock Map Background */}
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-600">
                        <div className="text-center">
                            <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-.806-.98l-3.75-1.875m-6 10.618V7m6 10.618V7" />
                            </svg>
                            <p className="text-lg font-medium">Interactive Map Canvas</p>
                            <p className="text-sm">Geofence Center: {mockGeofence.center.join(', ')}</p>
                        </div>
                    </div>

                    {/* Blue Light Layer Overlay */}
                    <BlueLightLayer
                        phones={phones}
                        isVisible={showBlueLights}
                        onPhoneClick={(phone) => console.log('Clicked:', phone.name)}
                    />
                </div>

                {/* Safety Validation Sidebar */}
                <aside className="w-full md:w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Safety Compliance</h2>

                    {validationResult && (
                        <div className="space-y-4">
                            <div className={`p-4 rounded-lg border ${validationResult.isCompliant
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                }`}>
                                <div className="flex items-start gap-3">
                                    {validationResult.isCompliant ? (
                                        <svg className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    )}
                                    <div>
                                        <h3 className={`font-bold ${validationResult.isCompliant ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                                            }`}>
                                            {validationResult.isCompliant ? 'Compliant' : 'Action Required'}
                                        </h3>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                                            {validationResult.message}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Nearest Phone:</span>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        {validationResult.nearestPhoneName || 'None'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Distance:</span>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        {validationResult.distanceToNearestPhoneFeet >= 0
                                            ? `${validationResult.distanceToNearestPhoneFeet.toFixed(0)} ft`
                                            : 'N/A'}
                                    </span>
                                </div>
                            </div>

                            {validationResult.requiresPrivateSecurity && (
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                    <h4 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2">Private Security Required</h4>
                                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                                        Due to the distance from emergency infrastructure, campus policy requires private security for night-time events.
                                    </p>
                                    <button className="w-full py-2 px-4 bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors">
                                        Allocate Security Budget
                                    </button>
                                </div>
                            )}

                            <button
                                disabled={!validationResult.isCompliant && !validationResult.requiresPrivateSecurity}
                                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-md transition-colors"
                            >
                                Approve Event Layout
                            </button>
                        </div>
                    )}
                </aside>
            </main>
        </div>
    );
}
