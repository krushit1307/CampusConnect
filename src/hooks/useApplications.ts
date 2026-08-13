// =============================================================================
// Hook: useApplications
// Issue: #2978 - Build a 'Club Application & Tryout' Workflow
// Description: Manages the state for the ATS Kanban board.Handles fetching
// applications by status, drag - and - drop status updates, and bulk actions.
// =============================================================================

    import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface Application {
    id: string;
    user_id: string;
    answers_json: Record<string, any>;
    status: 'applied' | 'review' | 'interview' | 'accepted' | 'rejected';
    reviewer_notes: string | null;
    submitted_at: string;
    profiles?: {
        full_name: string;
        avatar_url: string | null;
    };
}

interface UseApplicationsReturn {
    applications: Record<string, Application[]>;
    isLoading: boolean;
    error: string | null;
    updateStatus: (appId: string, newStatus: Application['status']) => Promise<void>;
    bulkUpdateStatus: (appIds: string[], newStatus: Application['status']) => Promise<void>;
    refresh: () => Promise<void>;
}

const STATUSES: Application['status'][] = ['applied', 'review', 'interview', 'accepted', 'rejected'];

export function useApplications(clubId: string | null, formId: string | null): UseApplicationsReturn {
    const [applications, setApplications] = useState<Record<string, Application[]>>({
        applied: [],
        review: [],
        interview: [],
        accepted: [],
        rejected: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchApplications = useCallback(async () => {
        if (!clubId || !formId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('applications')
                .select(`
          *,
          profiles:user_id (full_name, avatar_url)
        `)
                .eq('form_id', formId)
                .order('submitted_at', { ascending: false });

            if (fetchError) throw fetchError;

            // Group by status for the Kanban board
            const grouped: Record<string, Application[]> = {
                applied: [], review: [], interview: [], accepted: [], rejected: []
            };

            (data as Application[] || []).forEach(app => {
                if (grouped[app.status]) {
                    grouped[app.status].push(app);
                }
            });

            setApplications(grouped);
        } catch (err: any) {
            console.error('[useApplications] Fetch failed:', err);
            setError(err.message || 'Failed to load applications.');
        } finally {
            setIsLoading(false);
        }
    }, [clubId, formId]);

    useEffect(() => {
        fetchApplications();
    }, [fetchApplications]);

    const updateStatus = async (appId: string, newStatus: Application['status']) => {
        // Optimistic update
        setApplications(prev => {
            const next = { ...prev };
            let movedApp: Application | undefined;

            // Find and remove from old column
            for (const status of STATUSES) {
                const idx = next[status].findIndex(a => a.id === appId);
                if (idx !== -1) {
                    movedApp = next[status][idx];
                    next[status] = next[status].filter(a => a.id !== appId);
                    break;
                }
            }

            // Add to new column
            if (movedApp) {
                movedApp.status = newStatus;
                next[newStatus] = [movedApp, ...next[newStatus]];
            }

            return next;
        });

        try {
            const { error: updateError } = await supabase
                .from('applications')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', appId);

            if (updateError) throw updateError;

            // Trigger email notification if moved to Interview or Accepted/Rejected
            if (['interview', 'accepted', 'rejected'].includes(newStatus)) {
                await supabase.functions.invoke('send-application-email', {
                    body: { application_id: appId, new_status: newStatus }
                });
            }
        } catch (err: any) {
            console.error('[useApplications] Update failed:', err);
            await fetchApplications(); // Revert on error
        }
    };

    const bulkUpdateStatus = async (appIds: string[], newStatus: Application['status']) => {
        try {
            const { error: updateError } = await supabase
                .from('applications')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .in('id', appIds);

            if (updateError) throw updateError;

            // Trigger bulk email dispatch
            await supabase.functions.invoke('send-bulk-application-emails', {
                body: { application_ids: appIds, new_status: newStatus }
            });

            await fetchApplications();
        } catch (err: any) {
            console.error('[useApplications] Bulk update failed:', err);
            setError(err.message || 'Bulk update failed.');
        }
    };

    return {
        applications,
        isLoading,
        error,
        updateStatus,
        bulkUpdateStatus,
        refresh: fetchApplications
    };
}
