// =============================================================================
// Hook: useEventPrerequisites
// Issue: #3224 - Implement 'Event Series Dependencies'(Prerequisites)
// Description: Checks if the current user meets the attendance prerequisites
// for a specific event.Returns eligibility status and a list of missing
// prerequisite titles to display in the UI warning component.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface PrerequisiteCheckResult {
    isEligible: boolean;
    missingPrerequisites: string[];
    hasOverride: boolean;
    allowConditional: boolean;
}

interface UseEventPrerequisitesReturn {
    result: PrerequisiteCheckResult | null;
    isLoading: boolean;
    error: string | null;
    recheck: () => Promise<void>;
}

export function useEventPrerequisites(eventId: string | null): UseEventPrerequisitesReturn {
    const [result, setResult] = useState<PrerequisiteCheckResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const checkPrerequisites = useCallback(async () => {
        if (!eventId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                // If not logged in, they can't have attended prerequisites, but we 
                // let the RSVP button handle the login redirect first.
                setResult({ isEligible: true, missingPrerequisites: [], hasOverride: false, allowConditional: false });
                setIsLoading(false);
                return;
            }

            // 1. Fetch event config (allow_conditional_rsvp)
            const { data: eventConfig, error: configError } = await supabase
                .from('events')
                .select('allow_conditional_rsvp, prerequisite_event_ids')
                .eq('id', eventId)
                .single();

            if (configError) throw configError;

            // If no prerequisites defined, bypass the RPC call
            if (!eventConfig.prerequisite_event_ids || eventConfig.prerequisite_event_ids.length === 0) {
                setResult({
                    isEligible: true,
                    missingPrerequisites: [],
                    hasOverride: false,
                    allowConditional: eventConfig.allow_conditional_rsvp
                });
                setIsLoading(false);
                return;
            }

            // 2. Execute the RPC to verify attendance
            const { data: rpcData, error: rpcError } = await supabase.rpc('check_event_prerequisites', {
                p_user_id: user.id,
                p_event_id: eventId
            });

            if (rpcError) throw rpcError;

            const checkResult = rpcData[0];

            setResult({
                isEligible: checkResult.is_eligible,
                missingPrerequisites: checkResult.missing_prerequisites || [],
                hasOverride: checkResult.has_override,
                allowConditional: eventConfig.allow_conditional_rsvp
            });

        } catch (err: any) {
            console.error('[useEventPrerequisites] Check failed:', err);
            setError(err.message || 'Failed to verify prerequisites.');
            // Default to eligible on error to prevent blocking legitimate users due to DB glitches
            setResult({ isEligible: true, missingPrerequisites: [], hasOverride: false, allowConditional: false });
        } finally {
            setIsLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        checkPrerequisites();
    }, [checkPrerequisites]);

    return {
        result,
        isLoading,
        error,
        recheck: checkPrerequisites
    };
}
