'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import RSVPWithCalendarCheck from '@/components/events/RSVPWithCalendarCheck';
import { getGoogleAuthUrl } from '@/lib/calendar/googleCalendar';
import { useAuth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EventDetailsPage() {
    const params = useParams();
    const eventId = params.id as string;
    const { user } = useAuth();

    const [event, setEvent] = useState<any>(null);
    const [hasCalendar, setHasCalendar] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            const { data: eventData } = await supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single();

            setEvent(eventData);

            if (user) {
                const { data: tokenData } = await supabase
                    .from('user_calendar_tokens')
                    .select('user_id')
                    .eq('user_id', user.id)
                    .single();

                setHasCalendar(!!tokenData);
            }

            setIsLoading(false);
        }
        fetchData();
    }, [eventId, user]);

    if (isLoading || !event) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    const handleRSVP = async () => {
        // Actual RSVP logic here
        console.log('RSVP confirmed for', eventId);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                    {event.title}
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {event.description}
                </p>

                <div className="mb-8 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        <strong>Date:</strong> {new Date(event.start_time).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        <strong>Location:</strong> {event.location}
                    </p>
                </div>

                {!user ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 mb-4">
                        Please log in to RSVP.
                    </p>
                ) : !hasCalendar ? (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                            Connect your Google Calendar to prevent double-booking and receive automatic conflict warnings.
                        </p>
                        <a
                            href={getGoogleAuthUrl()}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            Connect Google Calendar
                        </a>
                    </div>
                ) : null}

                <RSVPWithCalendarCheck
                    eventId={eventId}
                    eventStart={event.start_time}
                    eventEnd={event.end_time}
                    onRSVP={handleRSVP}
                />
            </div>
        </div>
    );
}
