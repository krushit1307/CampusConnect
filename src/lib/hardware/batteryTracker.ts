import { createClient } from '@supabase/supabase-js';
import { Resource, MaintenanceAlert } from '@/types/hardware';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Calculates the duration of a checkout in minutes.
 */
export function calculateCheckoutDuration(startTime: string, returnTime: string): number {
    const start = new Date(startTime).getTime();
    const end = new Date(returnTime).getTime();
    const durationMs = end - start;
    return Math.max(0, Math.round(durationMs / (1000 * 60)));
}

/**
 * Updates the resource's total flight minutes and checks for maintenance thresholds.
 * Automatically removes the resource from the available booking pool if maintenance is required.
 */
export async function updateResourceFlightMetrics(
    resourceId: string,
    durationMinutes: number
): Promise<{ resource: Resource; alert: MaintenanceAlert | null }> {
    // 1. Fetch current resource state
    const { data: resource, error: fetchError } = await supabase
        .from('resources')
        .select('*')
        .eq('id', resourceId)
        .single();

    if (fetchError || !resource) {
        throw new Error('Resource not found');
    }

    // 2. Calculate new total flight minutes
    const newTotalMinutes = (resource.total_flight_minutes || 0) + durationMinutes;

    // 3. Update the resource (trigger will automatically calculate health and maintenance flag)
    const { data: updatedResource, error: updateError } = await supabase
        .from('resources')
        .update({
            total_flight_minutes: newTotalMinutes,
            // If maintenance is now required, immediately mark as unavailable for booking
            available: newTotalMinutes >= 5500 ? false : resource.available
        })
        .eq('id', resourceId)
        .select()
        .single();

    if (updateError) {
        throw new Error(`Failed to update resource metrics: ${updateError.message}`);
    }

    // 4. Generate maintenance alert if threshold is crossed
    let alert: MaintenanceAlert | null = null;
    if (updatedResource.maintenance_required && !resource.maintenance_required) {
        alert = {
            resourceId: updatedResource.id,
            resourceName: updatedResource.name,
            totalFlightMinutes: updatedResource.total_flight_minutes,
            batteryHealthPercentage: updatedResource.battery_health_percentage,
            recommendedAction: 'IMMEDIATE: Purchase replacement battery and schedule maintenance. Resource removed from booking pool.',
        };

        // Log the alert in the system (mocked as a notification insert)
        await supabase.from('system_notifications').insert({
            type: 'maintenance_required',
            target_role: 'student_union_admin',
            message: `Hardware Alert: ${updatedResource.name} has reached ${updatedResource.total_flight_minutes} flight minutes. Battery health at ${updatedResource.battery_health_percentage.toFixed(1)}%.`,
            created_at: new Date().toISOString(),
        });
    }

    return {
        resource: updatedResource,
        alert,
    };
}
