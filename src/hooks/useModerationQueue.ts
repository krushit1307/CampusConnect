// =============================================================================
// Hook: useModerationQueue
// Issue: #3321 - Implement 'Role-Based Content Moderation Queues'
//  Description: Fetches the moderation queue filtered by the current user's 
//  specific permissions (Spam vs Safety). Handles resolving and dismissing reports.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export type ReportCategory = 'spam' | 'harassment' | 'misinformation' | 'danger' | 'copyright' | 'other';

export interface ModerationReport {
    id: string;
    reported_content_id: string;
    reporter_id: string;
    reason: string;
    category: ReportCategory;
    severity: number;
    status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
    created_at: string;
    content_preview?: string; // Joined from the reported table
}

interface UseModerationQueueReturn {
    reports: ModerationReport[];
    isLoading: boolean;
    error: string | null;
    permissions: { spam: boolean; safety: boolean; all: boolean };
    resolveReport: (id: string, action: 'delete_content' | 'warn_user' | 'ban_user') => Promise<boolean>;
    dismissReport: (id: string) => Promise<boolean>;
    refreshQueue: () => Promise<void>;
}

export function useModerationQueue(): UseModerationQueueReturn {
    const [reports, setReports] = useState<ModerationReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [permissions, setPermissions] = useState({ spam: false, safety: false, all: false });

    const fetchPermissions = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from('profiles')
            .select('can_moderate_spam, can_moderate_safety, can_moderate_all')
            .eq('id', user.id)
            .single();

        if (profile) {
            setPermissions({
                spam: profile.can_moderate_spam || false,
                safety: profile.can_moderate_safety || false,
                all: profile.can_moderate_all || false
            });
        }
    }, []);

    const fetchQueue = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // The RLS policy will automatically filter based on the user's permissions
            const { data, error: fetchError } = await supabase
                .from('reports')
                .select('*')
                .in('status', ['pending', 'under_review'])
                .order('severity', { ascending: false })
                .order('created_at', { ascending: true });

            if (fetchError) throw fetchError;
            setReports((data as ModerationReport[]) || []);
        } catch (err: any) {
            console.error('[useModerationQueue] Fetch failed:', err);
            setError(err.message || 'Failed to load moderation queue.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            await fetchPermissions();
            await fetchQueue();
        };
        init();
    }, [fetchPermissions, fetchQueue]);

    const resolveReport = async (id: string, action: string): Promise<boolean> => {
        try {
            // In a real app, we'd execute the specific action (delete post, ban user, etc.) here
            // For now, we just mark the report as resolved

            const { error: updateError } = await supabase
                .from('reports')
                .update({
                    status: 'resolved',
                    resolved_at: new Date().toISOString()
                })
                .eq('id', id);

            if (updateError) throw updateError;

            setReports(prev => prev.filter(r => r.id !== id));
            return true;
        } catch (err: any) {
            console.error('[useModerationQueue] Resolve failed:', err);
            return false;
        }
    };

    const dismissReport = async (id: string): Promise<boolean> => {
        try {
            const { error: updateError } = await supabase
                .from('reports')
                .update({ status: 'dismissed' })
                .eq('id', id);

            if (updateError) throw updateError;

            setReports(prev => prev.filter(r => r.id !== id));
            return true;
        } catch (err: any) {
            console.error('[useModerationQueue] Dismiss failed:', err);
            return false;
        }
    };

    return {
        reports,
        isLoading,
        error,
        permissions,
        resolveReport,
        dismissReport,
        refreshQueue: fetchQueue
    };
}
