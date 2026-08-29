// =============================================================================
// Hook: useBlindNetworking
// Issue: #3697 - Develop a 'Dynamic "Blind Networking" Matchmaker'
// Description: Manages the user's availability toggle, triggers the matching
// Edge Function, loads existing matches, and exposes a safety report action.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface NetworkingMatch {
    id: string;
    partnerName: string;
    partnerMajor: string;
    icebreakers: string[];
    channelId: string | null;
    status: string;
}

interface UseBlindNetworkingReturn {
    isActive: boolean;
    matches: NetworkingMatch[];
    isLoading: boolean;
    isMatching: boolean;
    error: string | null;
    toggleActive: (active: boolean) => Promise<void>;
    findMatch: () => Promise<void>;
    reportMatch: (matchId: string, reason: string) => Promise<void>;
}

export function useBlindNetworking(): UseBlindNetworkingReturn {
    const [isActive, setIsActive] = useState(false);
    const [matches, setMatches] = useState<NetworkingMatch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMatching, setIsMatching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load the user's availability preference + their existing matches
    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: prefs } = await supabase
                .from('networking_preferences')
                .select('is_active')
                .eq('user_id', user.id)
                .maybeSingle();
            setIsActive(prefs?.is_active ?? false);

            // Matches where the user is either side
            const { data: rows, error: matchErr } = await supabase
                .from('networking_matches')
                .select('id, user_a, user_b, icebreakers, channel_id, status')
                .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
            if (matchErr) throw matchErr;

            // Resolve each partner's profile
            const enriched: NetworkingMatch[] = [];
            for (const row of (rows || [])) {
                const partnerId = row.user_a === user.id ? row.user_b : row.user_a;
                const { data: partner } = await supabase
                    .from('profiles')
                    .select('full_name, major')
                    .eq('id', partnerId)
                    .single();
                enriched.push({
                    id: row.id,
                    partnerName: partner?.full_name || 'Someone',
                    partnerMajor: partner?.major || 'Unknown',
                    icebreakers: row.icebreakers || [],
                    channelId: row.channel_id,
                    status: row.status,
                });
            }
            setMatches(enriched);
        } catch (err: any) {
            console.error('[useBlindNetworking] Load failed:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Upsert availability preference
    const toggleActive = useCallback(async (active: boolean) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { error: upErr } = await supabase.from('networking_preferences').upsert({
            user_id: user.id,
            is_active: active,
            updated_at: new Date().toISOString(),
        });
        if (upErr) { setError(upErr.message); return; }
        setIsActive(active);
    }, []);

    // Trigger the matcher
    const findMatch = useCallback(async () => {
        setIsMatching(true);
        setError(null);
        try {
            const { data, error: fnErr } = await supabase.functions.invoke('create-networking-match', {
                body: {},
            });
            if (fnErr) throw fnErr;
            if (data.error) throw new Error(data.error);
            if (!data.success) {
                setError('No eligible partners right now. Check back soon!');
            }
            await load();
        } catch (err: any) {
            setError(err.message || 'Matching failed.');
        } finally {
            setIsMatching(false);
        }
    }, [load]);

    // Safety: flag a match for moderation review
    const reportMatch = useCallback(async (matchId: string, reason: string) => {
        try {
            const { error: updErr } = await supabase
                .from('networking_matches')
                .update({ status: 'reported' })
                .eq('id', matchId);
            if (updErr) throw updErr;

            // File a moderation report so the safety team can review
            await supabase.from('reports').insert({
                reported_content_id: matchId,
                category: 'harassment',
                reason: `Blind networking report: ${reason}`,
                severity: 4,
            });
            setMatches(prev => prev.filter(m => m.id !== matchId));
        } catch (err: any) {
            setError(err.message || 'Report failed.');
        }
    }, []);

    return { isActive, matches, isLoading, isMatching, error, toggleActive, findMatch, reportMatch };
}
