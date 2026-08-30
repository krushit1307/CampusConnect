// =============================================================================
// Hook: useDonationImpact
// Issue: #3709 - Develop a 'Dynamic "Alumni Donation" Tracker'
// Description: Loads an alum's donations with the events they funded, including
// attendee metrics and photo galleries, for the personalized Impact Dashboard.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface DonationImpact {
    id: string;
    amount: number;
    message: string | null;
    impact_reported: boolean;
    created_at: string;
    event: {
        id: string;
        title: string;
        cover_image_url: string | null;
        attendee_count: number;
        club_name: string;
        photos: string[];
    } | null;
}

interface UseDonationImpactReturn {
    donations: DonationImpact[];
    totalGiven: number;
    isLoading: boolean;
    error: string | null;
}

export function useDonationImpact(): UseDonationImpactReturn {
    const [donations, setDonations] = useState<DonationImpact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: rows, error: donErr } = await supabase
                .from('donations')
                .select('id, amount, message, impact_reported, created_at, allocated_to_event_id')
                .eq('alum_user_id', user.id)
                .order('created_at', { ascending: false });
            if (donErr) throw donErr;

            // Resolve each allocated event + its metrics + gallery
            const enriched: DonationImpact[] = [];
            for (const row of (rows || [])) {
                let event: DonationImpact['event'] = null;
                if (row.allocated_to_event_id) {
                    const { data: ev } = await supabase
                        .from('events')
                        .select('id, title, cover_image_url, clubs(name)')
                        .eq('id', row.allocated_to_event_id)
                        .single();

                    const { count } = await supabase
                        .from('event_rsvps')
                        .select('*', { count: 'exact', head: true })
                        .eq('event_id', row.allocated_to_event_id)
                        .eq('checked_in', true);

                    const { data: gallery } = await supabase
                        .from('event_photos')
                        .select('url')
                        .eq('event_id', row.allocated_to_event_id)
                        .limit(6);

                    event = {
                        id: ev?.id,
                        title: ev?.title || 'Event',
                        cover_image_url: ev?.cover_image_url || null,
                        attendee_count: count || 0,
                        club_name: (ev?.clubs as any)?.name || 'Club',
                        photos: (gallery || []).map((p: any) => p.url),
                    };
                }
                enriched.push({
                    id: row.id, amount: Number(row.amount), message: row.message,
                    impact_reported: row.impact_reported, created_at: row.created_at, event,
                });
            }
            setDonations(enriched);
        } catch (err: any) {
            console.error('[useDonationImpact] Load failed:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const totalGiven = donations.reduce((s, d) => s + d.amount, 0);
    return { donations, totalGiven, isLoading, error };
}
