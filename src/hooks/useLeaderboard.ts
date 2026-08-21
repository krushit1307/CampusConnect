// =============================================================================
// Hook: useLeaderboard
// Issue: #2971 - Develop a 'Cross-Club Leaderboard' (Gamification)
--Description: Fetches the current leaderboard scores and calculates the
-- "Trending" indicators by comparing current ranks with the previous week's 
--snapshot from the database.
    // =============================================================================

    import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface LeaderboardEntry {
    club_id: string;
    club_name: string;
    logo_url: string | null;
    slug: string;
    total_score: number;
    valid_events_hosted: number;
    unique_attendees: number;
    total_members: number;
    avg_feedback_score: number;
    rank: number;
    trend: 'up' | 'down' | 'stable' | 'new';
    rank_change: number;
}

interface UseLeaderboardReturn {
    entries: LeaderboardEntry[];
    isLoading: boolean;
    error: string | null;
    refreshData: () => Promise<void>;
}

export function useLeaderboard(): UseLeaderboardReturn {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLeaderboard = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // 1. Fetch current scores from the materialized view
            const { data: currentScores, error: scoreError } = await supabase
                .from('club_leaderboard_scores')
                .select('*')
                .order('total_score', { ascending: false });

            if (scoreError) throw scoreError;

            // 2. Fetch previous week's ranks for trending calculation
            const lastWeekDate = new Date();
            lastWeekDate.setDate(lastWeekDate.getDate() - 7);
            const lastWeekStr = lastWeekDate.toISOString().split('T')[0];

            const { data: lastWeekSnapshots } = await supabase
                .from('leaderboard_snapshots')
                .select('club_id, rank')
                .eq('snapshot_date', lastWeekStr);

            const lastWeekRanks = new Map<string, number>();
            (lastWeekSnapshots || []).forEach(snap => {
                lastWeekRanks.set(snap.club_id, snap.rank);
            });

            // 3. Combine and calculate trends
            const formattedEntries: LeaderboardEntry[] = (currentScores || []).map((entry, index) => {
                const currentRank = index + 1;
                const prevRank = lastWeekRanks.get(entry.club_id);

                let trend: 'up' | 'down' | 'stable' | 'new' = 'stable';
                let rankChange = 0;

                if (prevRank === undefined) {
                    trend = 'new';
                } else if (currentRank < prevRank) {
                    trend = 'up';
                    rankChange = prevRank - currentRank;
                } else if (currentRank > prevRank) {
                    trend = 'down';
                    rankChange = prevRank - currentRank; // Negative number
                }

                return {
                    ...entry,
                    rank: currentRank,
                    trend,
                    rank_change: rankChange
                };
            });

            setEntries(formattedEntries);
        } catch (err: any) {
            console.error('[useLeaderboard] Fetch failed:', err);
            setError(err.message || 'Failed to load leaderboard.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    return {
        entries,
        isLoading,
        error,
        refreshData: fetchLeaderboard
    };
}
