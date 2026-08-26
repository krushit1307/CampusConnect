// =============================================================================
// Hook: useClubElections
// Issue: #3554 - Implement 'Secure Executive Board Election Voting with Anonymity'
// Description: Manages the state for club elections.Fetches active elections,
    // checks if the current user has already voted(via the ledger), and executes
// the secure RPC to cast an anonymous ballot.
    // =============================================================================

    import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface Candidate {
    id: string;
    name: string;
    platform: string;
    avatar_url?: string;
}

export interface ClubElection {
    id: string;
    club_id: string;
    position: string;
    description: string;
    candidates: Candidate[];
    status: 'draft' | 'active' | 'closed';
    start_date: string;
    end_date: string;
}

export interface ElectionResults {
    candidate_name: string;
    vote_count: number;
    percentage: number;
}

interface UseClubElectionsReturn {
    elections: ClubElection[];
    hasVoted: Record<string, boolean>; // election_id -> boolean
    isLoading: boolean;
    error: string | null;
    castVote: (electionId: string, candidateId: string) => Promise<boolean>;
    fetchResults: (electionId: string) => Promise<ElectionResults[]>;
}

export function useClubElections(clubId: string | null): UseClubElectionsReturn {
    const [elections, setElections] = useState<ClubElection[]>([]);
    const [hasVoted, setHasVoted] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchElections = useCallback(async () => {
        if (!clubId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // 1. Fetch active elections for the club
            const { data: electionData, error: electionError } = await supabase
                .from('club_elections')
                .select('*')
                .eq('club_id', clubId)
                .in('status', ['active', 'closed'])
                .order('created_at', { ascending: false });

            if (electionError) throw electionError;

            const formattedElections: ClubElection[] = (electionData || []).map(e => ({
                ...e,
                candidates: e.candidates_json as Candidate[]
            }));

            setElections(formattedElections);

            // 2. Check if user has voted in any of these elections
            if (formattedElections.length > 0) {
                const electionIds = formattedElections.map(e => e.id);

                const { data: ledgerData, error: ledgerError } = await supabase
                    .from('voter_ledger')
                    .select('election_id')
                    .eq('user_id', user.id)
                    .in('election_id', electionIds);

                if (ledgerError) throw ledgerError;

                const votedMap: Record<string, boolean> = {};
                (ledgerData || []).forEach(entry => {
                    votedMap[entry.election_id] = true;
                });

                setHasVoted(votedMap);
            }
        } catch (err: any) {
            console.error('[useClubElections] Fetch failed:', err);
            setError(err.message || 'Failed to load elections.');
        } finally {
            setIsLoading(false);
        }
    }, [clubId]);

    useEffect(() => {
        fetchElections();
    }, [fetchElections]);

    const castVote = async (electionId: string, candidateId: string): Promise<boolean> => {
        try {
            const { data, error: rpcError } = await supabase.rpc('cast_anonymous_vote', {
                p_election_id: electionId,
                p_candidate_selected: candidateId
            });

            if (rpcError) throw rpcError;

            // Update local state
            setHasVoted(prev => ({ ...prev, [electionId]: true }));
            return true;
        } catch (err: any) {
            console.error('[useClubElections] Vote failed:', err);
            setError(err.message || 'Failed to cast vote.');
            return false;
        }
    };

    const fetchResults = async (electionId: string): Promise<ElectionResults[]> => {
        try {
            const { data: ballots, error: ballotError } = await supabase
                .from('anonymous_ballots')
                .select('candidate_selected')
                .eq('election_id', electionId);

            if (ballotError) throw ballotError;

            const totalVotes = ballots?.length || 0;
            if (totalVotes === 0) return [];

            // Tally the votes
            const tally: Record<string, number> = {};
            (ballots || []).forEach(b => {
                tally[b.candidate_selected] = (tally[b.candidate_selected] || 0) + 1;
            });

            // Format results
            const results: ElectionResults[] = Object.entries(tally).map(([candidateId, count]) => {
                // Find candidate name from election data
                const election = elections.find(e => e.id === electionId);
                const candidate = election?.candidates.find(c => c.id === candidateId);

                return {
                    candidate_name: candidate?.name || 'Unknown Candidate',
                    vote_count: count,
                    percentage: Math.round((count / totalVotes) * 100)
                };
            });

            // Sort by vote count descending
            return results.sort((a, b) => b.vote_count - a.vote_count);
        } catch (err: any) {
            console.error('[useClubElections] Results fetch failed:', err);
            return [];
        }
    };

    return { elections, hasVoted, isLoading, error, castVote, fetchResults };
}
