import { supabase } from '../config/database'; // Adjust import based on your ORM/DB client
import { triggerWaitlistSwapEngine } from './waitlistService';

export async function handleCapacityOverride(eventId: string, newCapacity: number) {
    // 1. Call the Postgres RPC
    const { data, error } = await supabase.rpc('override_event_capacity', {
        p_event_id: eventId,
        p_new_capacity: newCapacity
    });

    if (error) {
        throw new Error(`Capacity override failed: ${error.message}`);
    }

    // 2. Trigger Waitlist Swap Engine if capacity was increased
    if (data.added_seats > 0) {
        // Run asynchronously so the organizer gets an immediate success response without waiting for SMS dispatches
        triggerWaitlistSwapEngine(eventId, data.added_seats).catch(err => {
            console.error(`Waitlist engine failed for event ${eventId}:`, err);
        });
    }

    return { 
        message: "Capacity updated successfully", 
        processed_waitlist: data.added_seats > 0,
        details: data
    };
}
