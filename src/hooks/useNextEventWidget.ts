// =============================================================================
// Hook: useNextEventWidget
// Issue: #3228 - Develop a 'Dynamic Event Countdown Widget' for Mobile Homescreens
// Description: Manages the state and logic for the Event Countdown Widget.
// Fetches the next upcoming RSVP'd event, calculates the live countdown timer,
// and handles the "RelativeTime" formatting (e.g., "Starts in 2h 15m").
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface NextEventWidgetData {
    eventId: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    coverImage: string | null;
    deepLink: string;
}

export interface CountdownState {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isLive: boolean; // True if the event is currently happening
    isPast: boolean;  // True if the event has ended
    relativeText: string; // e.g., "Starts in 2h 15m"
}

interface UseNextEventWidgetReturn {
    event: NextEventWidgetData | null;
    countdown: CountdownState | null;
    isLoading: boolean;
    error: string | null;
    isEmpty: boolean;
    emptyMessage: string;
    refreshData: () => Promise<void>;
}

const EMPTY_STATE_MESSAGE = "Your schedule is clear. Tap to discover events!";

export function useNextEventWidget(): UseNextEventWidgetReturn {
    const [event, setEvent] = useState<NextEventWidgetData | null>(null);
    const [countdown, setCountdown] = useState<CountdownState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEmpty, setIsEmpty] = useState(false);
    const [emptyMessage, setEmptyMessage] = useState(EMPTY_STATE_MESSAGE);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const calculateCountdown = useCallback((startDate: string, endDate: string): CountdownState => {
        const now = new Date().getTime();
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();

        // Event is currently happening
        if (now >= start && now < end) {
            const distance = end - now;
            return {
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((distance % (1000 * 60)) / 1000),
                isLive: true,
                isPast: false,
                relativeText: 'Happening Now!'
            };
        }

        // Event has ended
        if (now >= end) {
            return {
                days: 0, hours: 0, minutes: 0, seconds: 0,
                isLive: false, isPast: true, relativeText: 'Event Ended'
            };
        }

        // Event is in the future
        const distance = start - now;
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        let relativeText = '';
        if (days > 0) {
            relativeText = `Starts in ${days}d ${hours}h`;
        } else if (hours > 0) {
            relativeText = `Starts in ${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            relativeText = `Starts in ${minutes}m`;
        } else {
            relativeText = 'Starting soon!';
        }

        return { days, hours, minutes, seconds, isLive: false, isPast: false, relativeText };
    }, []);

    const fetchNextEvent = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setIsEmpty(true);
                setEmptyMessage("Please log in to see your next event.");
                setIsLoading(false);
                return;
            }

            const now = new Date().toISOString();
            const { data, error: fetchError } = await supabase
                .from('event_rsvps')
                .select(`
          event_id,
          events (
            id, title, location, event_date, end_date, cover_image_url
          )
        `)
                .eq('user_id', user.id)
                .eq('status', 'confirmed')
                .gt('events.event_date', now)
                .order('events.event_date', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (!data || !data.events) {
                setEvent(null);
                setIsEmpty(true);
                setEmptyMessage(EMPTY_STATE_MESSAGE);
                setCountdown(null);
            } else {
                const e = data.events as any;
                const eventData: NextEventWidgetData = {
                    eventId: e.id,
                    title: e.title,
                    location: e.location || 'TBA',
                    startDate: e.event_date,
                    endDate: e.end_date || e.event_date,
                    coverImage: e.cover_image_url,
                    deepLink: `/events/${e.id}`
                };

                setEvent(eventData);
                setIsEmpty(false);
                setCountdown(calculateCountdown(eventData.startDate, eventData.endDate));
            }
        } catch (err: any) {
            console.error('[useNextEventWidget] Fetch failed:', err);
            setError(err.message || 'Failed to load next event.');
        } finally {
            setIsLoading(false);
        }
    }, [calculateCountdown]);

    // Live countdown ticker
    useEffect(() => {
        if (event) {
            timerRef.current = setInterval(() => {
                setCountdown(calculateCountdown(event.startDate, event.endDate));
            }, 1000);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [event, calculateCountdown]);

    useEffect(() => {
        fetchNextEvent();
    }, [fetchNextEvent]);

    return {
        event,
        countdown,
        isLoading,
        error,
        isEmpty,
        emptyMessage,
        refreshData: fetchNextEvent
    };
}