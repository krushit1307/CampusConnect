/**
 * Bouncer and Capacity Control Types for CampusConnect
 * Defines interfaces for real-time capacity tracking and emergency overrides.
 */

export interface EventCapacity {
    eventId: string;
    venue_physical_capacity: number;
    checked_in_count: number;
    emergency_halt_active: boolean;
    total_confirmed: number;
}

export interface CheckInRequest {
    eventId: string;
    ticketId: string; // Registration ID
    userId: string;
    bouncerId: string;
}

export interface CheckInResponse {
    success: boolean;
    message: string;
    status: 'success' | 'denied_capacity' | 'denied_invalid' | 'denied_halt';
    refundTriggered?: boolean;
    checkedInCount?: number;
    capacity?: number;
}

export interface EmergencyHaltRequest {
    eventId: string;
    bouncerId: string;
    reason: string;
}
