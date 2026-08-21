// =============================================================================
// Hook: useElections
// Issue: #3231 - Develop a 'Secure Digital Voting Ballot' for Student Union
// Description: Manages the state for the voting booth. Fetches active elections, 
// candidates, handles the cryptographic hashing of the vote, and submits it 
// via the Edge Function. Also handles ballot ledger verification.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface Election {
    id: string;
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    is_active: boolean;
}

export interface Candidate {
    id: string;
    election_id: string;
    name: string;
    platform_summary: string;
    display_order: number;
}

interface UseElectionsReturn {
    activeElections: Election[];
    candidates: Record<string, Candidate[]>;
    hasVoted: Record<string, boolean>;
    isLoading: boolean;
    error: string | null;
    castVote: (electionId: string, candidateId: string) => Promise<string | null>;
    verifyBallot: (trackingNumber: string) => Promise<any | null>;
}

export function useElections(): UseElectionsReturn {
    const [activeElections, setActiveElections] = useState<Election[]>([]);
    const [candidates, setCandidates] = useState<Record<string, Candidate[]>>({});
    const [hasVoted, setHasVoted] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // 1. Fetch active elections
            const { data: elections, error: elError } = await supabase
                .from('elections')
                .select('*')
                .eq('is_active', true)
                .gt('end_time', new Date().toISOString());

            if (elError) throw elError;
            setActiveElections(elections || []);

            if (!elections || elections.length === 0) {
                setIsLoading(false);
                return;
            }

            const electionIds = elections.map(e => e.id);

            // 2. Fetch candidates for these elections
            const { data: cands, error: candError } = await supabase
                .from('election_candidates')
                .select('*')
                .in('election_id', electionIds)
                .order('display_order', { ascending: true });

            if (candError) throw candError;

            const groupedCands: Record<string, Candidate[]> = {};
            (cands || []).forEach(c => {
                if (!groupedCands[c.election_id]) groupedCands[c.election_id] = [];
                groupedCands[c.election_id].push(c as Candidate);
            });
            setCandidates(groupedCands);

            // 3. Check participation status for current user
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: participation } = await supabase
                    .from('election_participation')
                    .select('election_id')
                    .eq('user_id', user.id)
                    .in('election_id', electionIds);

                const votedMap: Record<string, boolean> = {};
                (participation || []).forEach(p => { votedMap[p.election_id] = true; });
                setHasVoted(votedMap);
            }

        } catch (err: any) {
            console.error('[useElections] Fetch failed:', err);
            setError(err.message || 'Failed to load elections.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    /**
     * Generates a deterministic hash of the vote payload on the client side.
     * This allows the user to verify their vote on the public ledger without 
     * the server ever knowing who cast which specific ballot.
     */
    const generateClientHash = async (electionId: string, candidateId: string): Promise<string> => {
        const payload = `${electionId}:${candidateId}`;
        const msgBuffer = new TextEncoder().encode(payload);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const castVote = async (electionId: string, candidateId: string): Promise<string | null> => {
        try {
            const clientHash = await generateClientHash(electionId, candidateId);

            const { data, error: fnError } = await supabase.functions.invoke('cast-secure-vote', {
                body: {
                    election_id: electionId,
                    candidate_id: candidateId,
                    client_hash: clientHash
                }
            });

            if (fnError) throw fnError;
            if (data.error) throw new Error(data.error);

            // Update local state
            setHasVoted(prev => ({ ...prev, [electionId]: true }));

            return data.tracking_number;
        } catch (err: any) {
            console.error('[useElections] Cast vote failed:', err);
            setError(err.message);
            return null;
        }
    };

    const verifyBallot = async (trackingNumber: string): Promise<any | null> => {
        try {
            const { data, error: fetchError } = await supabase
                .from('secure_ballots')
                .select('tracking_number, encrypted_payload, cast_at')
                .eq('tracking_number', trackingNumber)
                .maybeSingle();

            if (fetchError) throw fetchError;
            return data;
        } catch (err) {
            console.error('[useElections] Verify failed:', err);
            return null;
        }
    };

    return {
        activeElections,
        candidates,
        hasVoted,
        isLoading,
        error,
        castVote,
        verifyBallot
    };
}
