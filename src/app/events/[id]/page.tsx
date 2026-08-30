'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import RSVPWithCalendarCheck from '@/components/events/RSVPWithCalendarCheck';
import SponsorLogoDisplay from '@/components/events/SponsorLogoDisplay';
import { SponsorCPCSetting } from '@/types/sponsors';
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
    const [sponsors, setSponsors] = useState<SponsorCPCSetting[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            // Fetch Event Details
            const { data: eventData } = await supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single();

            setEvent(eventData);

            // Fetch Calendar Status
            if (user) {
                const { data: tokenData } = await supabase
                    .from('user_calendar_tokens')
                    .select('user_id')
                    .eq('user_id', user.id)
                    .single();

                setHasCalendar(!!tokenData);
            }

            // Fetch Sponsors
            const { data: sponsorData, error: sponsorError } = await supabase
                .from('sponsor_cpc_settings')
                .select(`
          id,
          sponsor_id,
          event_id,
          cost_per_click,
          max_budget,
          current_spent,
          is_active,
          sponsors (name, logo_url, target_url)
        `)
                .eq('event_id', eventId)
                .eq('is_active', true);

            if (!sponsorError && sponsorData) {
                // Flatten the nested sponsor data for easier consumption
                const formattedSponsors = sponsorData.map((item: any) => ({
                    id: item.id,
                    sponsor_id: item.sponsor_id,
                    event_id: item.event_id,
                    cost_per_click: item.cost_per_click,
                    max_budget: item.max_budget,
                    current_spent: item.current_spent,
                    is_active: item.is_active,
                    sponsor_name: item.sponsors.name,
                    logo_url: item.sponsors.logo_url,
                    target_url: item.sponsors.target_url,
                }));
                setSponsors(formattedSponsors);
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
            <div className="max-w-6xl mx-auto">
                {/* Main Event Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-12">
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

                {/* Sponsors Section */}
                {sponsors.length > 0 && (
                    <div className="mt-12">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                            <svg className="w-6 h-6 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            Event Sponsors
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {sponsors.map((sponsor) => (
                                <SponsorLogoDisplay key={sponsor.id} setting={sponsor} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
