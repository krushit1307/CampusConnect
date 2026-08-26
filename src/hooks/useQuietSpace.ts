// =============================================================================
// Hook: useQuietSpace
// Issue: #3555 - Develop a 'Dynamic "Quiet Space" Finder for Events'
// Description: Fetches the quiet space details for a specific event and
// verifies if the current user is checked in. Only checked-in users at
// large events should see the Quiet Space FAB.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface QuietSpaceDetails {
    location: string;
    description: string;
    photoUrl: string | null;
}

interface UseQuietSpaceReturn {
    details: QuietSpaceDetails | null;
    isCheckedIn: boolean;
    isLoading: boolean;
    error: string | null;
}

export function useQuietSpace(eventId: string | null, currentUserId: string | null): UseQuietSpaceReturn {
    const [details, setDetails] = useState<QuietSpaceDetails | null>(null);
    const [isCheckedIn, setIsCheckedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!eventId || !currentUserId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 1. Fetch event details and capacity requirement
            const { data: event, error: eventError } = await supabase
                .from('events')
                .select('capacity, quiet_space_location, quiet_space_description, quiet_space_photo_url, requires_quiet_space')
                .eq('id', eventId)
                .single();

            if (eventError) throw eventError;

            // If the event doesn't require a quiet space or hasn't defined one, exit early
            if (!event.requires_quiet_space || !event.quiet_space_location) {
                setDetails(null);
                setIsLoading(false);
                return;
            }

            setDetails({
                location: event.quiet_space_location,
                description: event.quiet_space_description || '',
                photoUrl: event.quiet_space_photo_url
            });

            // 2. Check if the user is currently checked in to this event
            const { data: rsvp, error: rsvpError } = await supabase
                .from('event_rsvps')
                .select('checked_in')
                .eq('event_id', eventId)
                .eq('user_id', currentUserId)
                .maybeSingle();

            if (rsvpError) throw rsvpError;

            setIsCheckedIn(rsvp?.checked_in === true);

        } catch (err: any) {
            console.error('[useQuietSpace] Fetch failed:', err);
            setError(err.message || 'Failed to load quiet space details.');
        } finally {
            setIsLoading(false);
        }
    }, [eventId, currentUserId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { details, isCheckedIn, isLoading, error };
}
