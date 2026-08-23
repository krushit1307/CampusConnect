// =============================================================================
// Hook: useEventFeedback
// Issue: #4042 - Implement 'Automated "Post-Event Feedback" Aggregation'
// Description: Handles the submission of 1-click feedback via secure token 
// validation, ensuring unauthenticated users can rate events safely.
// =============================================================================

import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface UseEventFeedbackReturn {
    isSubmitting: boolean;
    error: string | null;
    submitFeedback: (eventId: string, userId: string, token: string, rating: number) => Promise<boolean>;
}

export function useEventFeedback(): UseEventFeedbackReturn {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submitFeedback = useCallback(async (eventId: string, userId: string, token: string, rating: number): Promise<boolean> => {
        setIsSubmitting(true);
        setError(null);

        try {
            // Call Edge Function to validate token and insert feedback securely
            const { data, error: fnErr } = await supabase.functions.invoke('submit-feedback', {
                body: { event_id: eventId, user_id: userId, token, rating }
            });

            if (fnErr) throw fnErr;
            if (data.error) throw new Error(data.error);

            return true;
        } catch (err: any) {
            console.error('[useEventFeedback] Submit failed:', err);
            setError(err.message || 'Failed to submit feedback.');
            return false;
        } finally {
            setIsSubmitting(false);
        }
    }, []);

    return { isSubmitting, error, submitFeedback };
}
