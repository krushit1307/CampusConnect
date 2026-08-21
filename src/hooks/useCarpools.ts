// =============================================================================
// Hook: useCarpools
// Issue: #3222 - Develop a 'Carpool Coordination' Module for Off-Campus Events
// Description: Manages the state for carpool listings, seat requests, and 
// driver approvals.Handles the mandatory legal waiver check before allowing
// any carpool interactions.
// =============================================================================

    import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface CarpoolListing {
    id: string;
    event_id: string;
    driver_user_id: string;
    total_seats: number;
    available_seats: number;
    departure_location: string;
    departure_time: string;
    vehicle_description: string | null;
    notes: string | null;
    is_cancelled: boolean;
    profiles?: { full_name: string; avatar_url: string | null };
    passengers?: { passenger_user_id: string; status: string; profiles: { full_name: string } }[];
}

interface UseCarpoolsReturn {
    carpools: CarpoolListing[];
    isLoading: boolean;
    error: string | null;
    hasSignedWaiver: boolean;
    checkWaiver: () => Promise<boolean>;
    signWaiver: () => Promise<boolean>;
    createCarpool: (data: Omit<CarpoolListing, 'id' | 'driver_user_id' | 'profiles' | 'passengers'>) => Promise<boolean>;
    requestSeat: (carpoolId: string) => Promise<boolean>;
    updateRequestStatus: (carpoolId: string, passengerId: string, status: 'accepted' | 'rejected') => Promise<boolean>;
    cancelCarpool: (carpoolId: string) => Promise<boolean>;
}

export function useCarpools(eventId: string | null): UseCarpoolsReturn {
    const [carpools, setCarpools] = useState<CarpoolListing[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasSignedWaiver, setHasSignedWaiver] = useState(false);

    const checkWaiver = useCallback(async (): Promise<boolean> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { data, error: fetchError } = await supabase
            .from('carpool_waivers')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (fetchError) return false;
        const signed = !!data;
        setHasSignedWaiver(signed);
        return signed;
    }, []);

    const signWaiver = async (): Promise<boolean> => {
        try {
            const { error: insertError } = await supabase.from('carpool_waivers').insert({});
            if (insertError) throw insertError;
            setHasSignedWaiver(true);
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    };

    const fetchCarpools = useCallback(async () => {
        if (!eventId) return;
        setIsLoading(true);
        try {
            const { data, error: fetchError } = await supabase
                .from('carpools')
                .select(`
          *,
          profiles:driver_user_id (full_name, avatar_url),
          passengers:carpool_passengers (passenger_user_id, status, profiles:passenger_user_id(full_name))
        `)
                .eq('event_id', eventId)
                .eq('is_cancelled', false)
                .order('departure_time', { ascending: true });

            if (fetchError) throw fetchError;
            setCarpools((data as CarpoolListing[]) || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        checkWaiver();
        fetchCarpools();
    }, [checkWaiver, fetchCarpools]);

    const createCarpool = async (data: any): Promise<boolean> => {
        if (!hasSignedWaiver) {
            setError('You must sign the legal waiver before offering a ride.');
            return false;
        }
        try {
            const { error: insertError } = await supabase.from('carpools').insert({
                ...data,
                event_id: eventId,
                available_seats: data.total_seats
            });
            if (insertError) throw insertError;
            await fetchCarpools();
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    };

    const requestSeat = async (carpoolId: string): Promise<boolean> => {
        if (!hasSignedWaiver) {
            setError('You must sign the legal waiver before requesting a ride.');
            return false;
        }
        try {
            const { error: insertError } = await supabase.from('carpool_passengers').insert({
                carpool_id: carpoolId,
                status: 'pending'
            });
            if (insertError) throw insertError;
            await fetchCarpools();
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    };

    const updateRequestStatus = async (carpoolId: string, passengerId: string, status: 'accepted' | 'rejected'): Promise<boolean> => {
        try {
            const { error: updateError } = await supabase
                .from('carpool_passengers')
                .update({ status })
                .eq('carpool_id', carpoolId)
                .eq('passenger_user_id', passengerId);

            if (updateError) throw updateError;

            // If accepted, decrement available seats
            if (status === 'accepted') {
                await supabase.rpc('decrement_carpool_seats', { p_carpool_id: carpoolId });
            }

            await fetchCarpools();
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    };

    const cancelCarpool = async (carpoolId: string): Promise<boolean> => {
        try {
            const { error: updateError } = await supabase
                .from('carpools')
                .update({ is_cancelled: true })
                .eq('id', carpoolId);
            if (updateError) throw updateError;
            await fetchCarpools();
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    };

    return {
        carpools, isLoading, error, hasSignedWaiver,
        checkWaiver, signWaiver, createCarpool, requestSeat, updateRequestStatus, cancelCarpool
    };
}
