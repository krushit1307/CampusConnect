// =============================================================================
// Hook: useAccessibilityRequests
// Issue: #3551 - Implement 'Dynamic Accessibility Sign Language Interpreter Request'
// Description: Manages the creation and status tracking of accessibility requests.
// Triggers the Edge Function to email the Disability Center when a new request
// is submitted during the RSVP flow.
    // =============================================================================

    import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export type AccessibilityType = 'asl_interpreter' | 'captioning_device' | 'wheelchair_access' | 'other';
export type RequestStatus = 'pending' | 'confirmed' | 'denied' | 'fulfilled';

export interface AccessibilityRequest {
    id: string;
    rsvp_id: string;
    event_id: string;
    request_type: AccessibilityType;
    additional_notes: string | null;
    status: RequestStatus;
    confirmed_at: string | null;
    created_at: string;
}

interface UseAccessibilityRequestsReturn {
    isSubmitting: boolean;
    error: string | null;
    submitRequest: (rsvpId: string, eventId: string, type: AccessibilityType, notes?: string) => Promise<boolean>;
    updateStatus: (requestId: string, status: RequestStatus) => Promise<boolean>;
}

export function useAccessibilityRequests(): UseAccessibilityRequestsReturn {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submitRequest = async (
        rsvpId: string,
        eventId: string,
        type: AccessibilityType,
        notes?: string
    ): Promise<boolean> => {
        setIsSubmitting(true);
        setError(null);

        try {
            // 1. Insert the request into the database
            const { data: request, error: insertError } = await supabase
                .from('accessibility_requests')
                .insert({
                    rsvp_id: rsvpId,
                    event_id: eventId,
                    request_type: type,
                    additional_notes: notes || null,
                    status: 'pending'
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // 2. Trigger the Edge Function to email the Disability Center
            const { error: fnError } = await supabase.functions.invoke('request-accessibility', {
                body: { request_id: request.id }
            });

            if (fnError) {
                console.warn('[useAccessibilityRequests] Email trigger failed, but request was saved:', fnError);
            }

            setIsSubmitting(false);
            return true;
        } catch (err: any) {
            console.error('[useAccessibilityRequests] Submit failed:', err);
            setError(err.message || 'Failed to submit accessibility request.');
            setIsSubmitting(false);
            return false;
        }
    };

    const updateStatus = async (requestId: string, status: RequestStatus): Promise<boolean> => {
        try {
            const { error: updateError } = await supabase
                .from('accessibility_requests')
                .update({
                    status,
                    confirmed_at: status === 'confirmed' ? new Date().toISOString() : null
                })
                .eq('id', requestId);

            if (updateError) throw updateError;
            return true;
        } catch (err: any) {
            console.error('[useAccessibilityRequests] Update failed:', err);
            return false;
        }
    };

    return { isSubmitting, error, submitRequest, updateStatus };
}
