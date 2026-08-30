import { createClient } from '@supabase/supabase-js';
import { EventCapacity, CheckInResponse } from '@/types/bouncer';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Fetches real-time capacity metrics for an event.
 */
export async function getEventCapacity(eventId: string): Promise<EventCapacity> {
    // Get event capacity and halt status
    const { data: event, error: eventError } = await supabase
        .from('events')
        .select('venue_physical_capacity, emergency_halt_active')
        .eq('id', eventId)
        .single();

    if (eventError || !event) {
        throw new Error('Event not found');
    }

    // Count checked-in attendees
    const { count: checkedInCount, error: countError } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .not('checked_in_at', 'is', null);

    if (countError) {
        throw new Error('Failed to count checked-in attendees');
    }

    // Count total confirmed
    const { count: totalConfirmed, error: totalError } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'confirmed');

    return {
        eventId,
        venue_physical_capacity: event.venue_physical_capacity,
        checked_in_count: checkedInCount || 0,
        emergency_halt_active: event.emergency_halt_active,
        total_confirmed: totalConfirmed || 0,
    };
}

/**
 * Triggers the emergency capacity halt, invalidating all un-scanned tickets.
 */
export async function triggerEmergencyHalt(eventId: string, bouncerId: string, reason: string): Promise<void> {
    const { error } = await supabase
        .from('events')
        .update({
            emergency_halt_active: true,
            emergency_halt_triggered_at: new Date().toISOString(),
            emergency_halt_triggered_by: bouncerId,
        })
        .eq('id', eventId);

    if (error) {
        throw new Error(`Failed to trigger emergency halt: ${error.message}`);
    }
}

/**
 * Processes an automated refund for a user denied entry due to capacity.
 */
export async function processCapacityDenialRefund(registrationId: string, userId: string, eventId: string): Promise<void> {
    // 1. Mark registration as refunded
    await supabase
        .from('event_registrations')
        .update({
            status: 'refunded_capacity',
            refund_processed_at: new Date().toISOString()
        })
        .eq('id', registrationId);

    // 2. Add refund transaction to ledger (assuming $10 ticket for example)
    await supabase.from('ledger_transactions').insert({
        user_id: userId,
        event_id: eventId,
        amount: 10.00, // Should be dynamic based on actual ticket price
        transaction_type: 'capacity_denial_refund',
        description: 'Automated refund: Venue reached maximum physical capacity.',
        status: 'completed',
    });
}
