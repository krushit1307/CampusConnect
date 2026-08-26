import { useState, useCallback } from 'react';
import { ClubSuggestion, SuggestionSubmission } from '../types/suggestions';

// Mocking Supabase client hook for simplicity
const useSupabase = () => {
    return {
        from: (table: string) => ({
            insert: async (data: any) => ({ error: null, data: [data] }),
            select: async () => ({
                order: () => ({
                    eq: async () => ({
                        data: [] as ClubSuggestion[],
                        error: null,
                    }),
                }),
            }),
            update: async (data: any) => ({
                eq: async () => ({ error: null }),
            }),
        }),
    };
};

export const useSuggestions = (clubId: string) => {
    const supabase = useSupabase();
    const [suggestions, setSuggestions] = useState<ClubSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Creates a pseudo-anonymous hash to satisfy the backend rate limiter
    const getClientHash = () => {
        // In a real scenario, this would be computed securely, likely server-side
        // based on IP or a blinded token. For client demo:
        return btoa(navigator.userAgent + new Date().toDateString()).substring(0, 16);
    };

    const submitSuggestion = useCallback(
        async (submission: SuggestionSubmission) => {
            setLoading(true);
            setError(null);

            try {
                const { error: submitError } = await supabase.from('club_suggestions').insert({
                    club_id: clubId,
                    message_text: submission.message_text,
                    client_ip_hash: getClientHash(),
                });

                if (submitError) {
                    throw new Error('Failed to submit suggestion. Please try again.');
                }

                return true;
            } catch (err: any) {
                setError(err.message || 'An error occurred while submitting.');
                return false;
            } finally {
                setLoading(false);
            }
        },
        [clubId, supabase]
    );

    const fetchSuggestions = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Simulated fetch
            const { data, error: fetchError } = await supabase
                .from('club_suggestions')
                .select('*')
                .order('submitted_at', { ascending: false })
                .eq('club_id', clubId);

            if (fetchError) {
                throw new Error('Failed to fetch suggestions.');
            }

            // Mock data for display purposes
            const mockData: ClubSuggestion[] = [
                {
                    id: '1',
                    club_id: clubId,
                    message_text: "We should host a hackathon next month!",
                    toxicity_score: 0.1,
                    is_quarantined: false,
                    submitted_at: new Date().toISOString(),
                    client_ip_hash: 'hash1',
                    status: 'UNREAD',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
                {
                    id: '2',
                    club_id: clubId,
                    message_text: "I felt left out during the last meeting. Can we do icebreakers?",
                    toxicity_score: 0.05,
                    is_quarantined: false,
                    submitted_at: new Date(Date.now() - 86400000).toISOString(),
                    client_ip_hash: 'hash2',
                    status: 'REVIEWED',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }
            ];

            setSuggestions(mockData || data || []);
        } catch (err: any) {
            setError(err.message || 'An error occurred while fetching.');
        } finally {
            setLoading(false);
        }
    }, [clubId, supabase]);

    const updateStatus = useCallback(
        async (id: string, status: 'UNREAD' | 'REVIEWED' | 'ACTIONED') => {
            try {
                const { error: updateError } = await supabase
                    .from('club_suggestions')
                    .update({ status })
                    .eq('id', id);

                if (updateError) {
                    throw new Error('Failed to update status.');
                }

                setSuggestions(prev =>
                    prev.map(s => s.id === id ? { ...s, status } : s)
                );
                return true;
            } catch (err: any) {
                setError(err.message || 'An error occurred while updating status.');
                return false;
            }
        },
        [supabase]
    );

    return {
        suggestions,
        loading,
        error,
        submitSuggestion,
        fetchSuggestions,
        updateStatus,
    };
};
