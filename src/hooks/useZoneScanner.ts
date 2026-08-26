// =============================================================================
// Hook: useZoneScanner
// Issue: #4047 - Develop a 'Dynamic "VIP/Sponsor" Access Control'
// Description: Manages the scanner's selected zone and handles the verification 
// API call, exposing the detailed access result for the UI to render.
// =============================================================================

import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface ScanResult {
    authorized: boolean;
    ticket: { tier: string; user_name: string; avatar_url: string | null };
    zone_name: string;
    required_tier: string;
    reject_reason: string | null;
}

interface UseZoneScannerReturn {
    selectedZoneId: string | null;
    zones: { id: string; name: string; min_required_tier: string }[];
    isLoadingZones: boolean;
    isVerifying: boolean;
    result: ScanResult | null;
    error: string | null;
    setSelectedZone: (id: string) => void;
    verifyTicket: (ticketId: string) => Promise<void>;
    clearResult: () => void;
}

export function useZoneScanner(eventId: string): UseZoneScannerReturn {
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
    const [zones, setZones] = useState<any[]>([]);
    const [isLoadingZones, setIsLoadingZones] = useState(true);
    const [isVerifying, setIsVerifying] = useState(false);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Load zones for the event
    const loadZones = useCallback(async () => {
        setIsLoadingZones(true);
        try {
            const { data, error: err } = await supabase
                .from('access_zones')
                .select('id, name, min_required_tier')
                .eq('event_id', eventId)
                .order('name', { ascending: true });

            if (err) throw err;
            setZones(data || []);
            if (data && data.length > 0 && !selectedZoneId) {
                setSelectedZoneId(data[0].id);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoadingZones(false);
        }
    }, [eventId, selectedZoneId]);

    const verifyTicket = useCallback(async (ticketId: string) => {
        if (!selectedZoneId) {
            setError("Please select an access zone first.");
            return;
        }

        setIsVerifying(true);
        setError(null);
        setResult(null);

        try {
            const { data, error: fnErr } = await supabase.functions.invoke('verify-zone-access', {
                body: { ticket_id: ticketId, zone_id: selectedZoneId }
            });

            if (fnErr) throw fnErr;
            if (data.error) throw new Error(data.error);

            setResult(data);
        } catch (err: any) {
            setError(err.message || 'Verification failed.');
            setResult({
                authorized: false,
                ticket: { tier: 'unknown', user_name: 'Unknown', avatar_url: null },
                zone_name: 'Unknown',
                required_tier: 'unknown',
                reject_reason: err.message
            });
        } finally {
            setIsVerifying(false);
        }
    }, [selectedZoneId]);

    const clearResult = useCallback(() => {
        setResult(null);
        setError(null);
    }, []);

    return {
        selectedZoneId, zones, isLoadingZones, isVerifying, result, error,
        setSelectedZone: setSelectedZoneId, verifyTicket, clearResult
    };
}
