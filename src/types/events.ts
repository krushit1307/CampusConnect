/**
 * Event and Concurrency Types for CampusConnect
 * Defines interfaces for event management, OCC, and multi-signature workflows.
 */

export type EventStatus = 'draft' | 'published' | 'active' | 'completed' | 'cancelled';

export interface Event {
    id: string;
    club_id: string;
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    location: string;
    status: EventStatus;
    version: number;
    cancellation_approved_by: string[];
    cancellation_requested_by: string | null;
    cancellation_requested_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface EventUpdatePayload {
    eventId: string;
    currentVersion: number;
    title?: string;
    description?: string;
    start_time?: string;
    end_time?: string;
    location?: string;
}

export interface MultiSigApprovalPayload {
    eventId: string;
    adminId: string;
    action: 'cancel';
}

export interface OCCError extends Error {
    name: 'OptimisticConcurrencyError';
    currentVersion: number;
    message: string;
}
