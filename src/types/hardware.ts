/**
 * Hardware and Battery Degradation Types for CampusConnect
 * Defines interfaces for resource tracking, maintenance alerts, and flight metrics.
 */

export interface Resource {
    id: string;
    name: string;
    category: string;
    total_flight_minutes: number;
    maintenance_required: boolean;
    last_maintenance_date: string | null;
    battery_health_percentage: number;
    available: boolean;
    created_at: string;
    updated_at: string;
}

export interface ResourceBooking {
    id: string;
    resource_id: string;
    club_id: string;
    start_time: string;
    end_time: string;
    actual_return_time: string | null;
    checkout_duration_minutes: number;
    status: 'pending' | 'approved' | 'active' | 'completed' | 'cancelled';
    created_at: string;
}

export interface CheckInPayload {
    bookingId: string;
    actualReturnTime: string;
    adminId: string;
    notes?: string;
}

export interface MaintenanceAlert {
    resourceId: string;
    resourceName: string;
    totalFlightMinutes: number;
    batteryHealthPercentage: number;
    recommendedAction: string;
}

export interface FlightMetric {
    resource_id: string;
    resource_name: string;
    resource_category: string;
    total_flight_minutes: number;
}
