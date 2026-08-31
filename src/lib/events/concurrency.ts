import { createClient } from '@supabase/supabase-js';
import { Event, OCCError } from '@/types/events';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Fetches an event with its current version for optimistic concurrency control.
 */
export async function getEventWithVersion(eventId: string): Promise<Event> {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (error || !data) {
        throw new Error('Event not found');
    }

    return data as Event;
}

/**
 * Updates an event using Optimistic Concurrency Control.
 * Throws an OCCError if the version has changed since the client last fetched it.
 */
export async function updateEventWithOCC(payload: {
    eventId: string;
    currentVersion: number;
    updates: Partial<Omit<Event, 'id' | 'club_id' | 'version' | 'created_at' | 'updated_at'>>;
}): Promise<Event> {
    const { data, error } = await supabase
        .from('events')
        .update(payload.updates)
        .eq('id', payload.eventId)
        .eq('version', payload.currentVersion)
        .select()
        .single();

    if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
            // Fetch the actual current version to return to the client
            const currentEvent = await getEventWithVersion(payload.eventId);
            const occError = new Error('Another Admin has modified this event since you opened it. Please refresh and try again.') as OCCError;
            occError.name = 'OptimisticConcurrencyError';
            occError.currentVersion = currentEvent.version;
            throw occError;
        }
        throw new Error(`Failed to update event: ${error.message}`);
    }

    return data as Event;
}

/**
 * Records a multi-signature approval for a destructive action.
 */
export async function addMultiSigApproval(eventId: string, adminId: string, action: 'cancel'): Promise<Event> {
    const { data, error } = await supabase.rpc('add_multisig_approval', {
        p_event_id: eventId,
        p_admin_id: adminId,
        p_action: action,
    });

    // Fallback if RPC doesn't exist yet, we do it manually via update
    if (error) {
        const event = await getEventWithVersion(eventId);
        const approvedBy = event.cancellation_approved_by || [];

        if (!approvedBy.includes(adminId)) {
            approvedBy.push(adminId);
        }

        const { data: updatedEvent, error: updateError } = await supabase
            .from('events')
            .update({
                cancellation_approved_by: approvedBy,
                cancellation_requested_at: new Date().toISOString(),
            })
            .eq('id', eventId)
            .select()
            .single();

        if (updateError) {
            throw new Error(`Failed to record approval: ${updateError.message}`);
        }
        return updatedEvent as Event;
    }

    return data as Event;
}
