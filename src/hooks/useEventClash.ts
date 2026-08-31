// =============================================================================
// Hook: useEventClash
// Issue: #3708 - Implement 'Automated "Event Clash" Negotiation'
// Description: Runs clash detection when a draft is saved, exposes the detected
// clashes, and gates the Publish action until the organizer acknowledges.
// =============================================================================

import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ClashResult } from '../../lib/events/clashDetection';

interface UseEventClashReturn {
    clashes: ClashResult[];
    isChecking: boolean;
    isBlocked: boolean;
    error: string | null;
    checkForClashes: (eventId: string) => Promise<boolean>;
    acknowledgeAndPublish: (eventId: string) => Promise<boolean>;
    reset: () => void;
}

export function useEventClash(): UseEventClashReturn {
    const [clashes, setClashes] = useState<ClashResult[]>([]);
    const [isChecking, setIsChecking] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = useCallback(() => {
        setClashes([]);
        setIsBlocked(false);
        setError(null);
    }, []);

    // Run detection; returns true if publishing should be blocked
    const checkForClashes = useCallback(async (eventId: string): Promise<boolean> => {
        setIsChecking(true);
        setError(null);
        try {
            const { data, error: fnErr } = await supabase.functions.invoke('detect-event-clash', {
                body: { event_id: eventId },
            });
            if (fnErr) throw fnErr;
            if (data.error) throw new Error(data.error);

            const found: ClashResult[] = data.clashes || [];
            setClashes(found);
            const blocked = found.length > 0;
            setIsBlocked(blocked);
            return blocked;
        } catch (err: any) {
            setError(err.message || 'Clash detection failed.');
            return false;
        } finally {
            setIsChecking(false);
        }
    }, []);

    // Organizer chooses to ignore the warning and publish anyway
    const acknowledgeAndPublish = useCallback(async (eventId: string): Promise<boolean> => {
        try {
            // Mark clashes acknowledged so the audit trail records the decision
            const { error: ackErr } = await supabase
                .from('event_clashes')
                .update({ status: 'acknowledged' })
                .eq('event_a', eventId);
            if (ackErr) throw ackErr;

            // Publish the event
            const { error: pubErr } = await supabase
                .from('events')
                .update({ status: 'published' })
                .eq('id', eventId);
            if (pubErr) throw pubErr;

            setIsBlocked(false);
            return true;
        } catch (err: any) {
            setError(err.message || 'Publish failed.');
            return false;
        }
    }, []);

    return { clashes, isChecking, isBlocked, error, checkForClashes, acknowledgeAndPublish, reset };
}
