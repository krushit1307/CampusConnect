'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import TransitItinerary from '@/components/events/TransitItinerary';
import { TransitRoute, TransitWarning } from '@/types/transit';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EventSchedulePage() {
    const params = useParams();
    const eventId = params.id as string;

    const [event, setEvent] = useState<any>(null);
    const [transitData, setTransitData] = useState<{ route: TransitRoute; warning: TransitWarning } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            // Mock event data with coordinates and end time
            const mockEvent = {
                id: eventId,
                title: 'Downtown Tech Workshop',
                location: 'Downtown Campus, 123 Main St',
                start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                end_time: new Date(Date.now() + 97200000).toISOString(), // Tomorrow + 3 hours
                origin_lat: 40.7128,
                origin_lng: -74.0060,
                dest_lat: 40.7580,
                dest_lng: -73.9855,
            };
            setEvent(mockEvent);

            try {
                const response = await fetch('/api/transit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        originLat: mockEvent.origin_lat,
                        originLng: mockEvent.origin_lng,
                        destLat: mockEvent.dest_lat,
                        destLng: mockEvent.dest_lng,
                        departureTime: new Date(new Date(mockEvent.start_time).getTime() - 45 * 60000).toISOString(), // 45 mins before
                        eventEndTime: mockEvent.end_time,
                    }),
                });
                const data = await response.json();
                if (data.success) {
                    setTransitData({ route: data.route, warning: data.warning });
                }
            } catch (error) {
                console.error('Failed to fetch transit data:', error);
            }
            setIsLoading(false);
        }
        fetchData();
    }, [eventId]);

    if (isLoading || !event) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{event.title}</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        {new Date(event.start_time).toLocaleString()} - {new Date(event.end_time).toLocaleString()}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">{event.location}</p>
                </div>

                {transitData ? (
                    <TransitItinerary route={transitData.route} warning={transitData.warning} />
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center border border-gray-200 dark:border-gray-700">
                        <p className="text-gray-500 dark:text-gray-400">
                            Transit information is only displayed for events located more than 2 miles from the main campus.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
