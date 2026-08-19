// =============================================================================
// Hook: useClubIntegrations
// Issue: #3542 - Implement 'Automated Multi-Channel Cross-Posting'
// Description: Manages the CRUD operations for club webhooks.Allows admins 
// to add Discord / Slack URLs, toggle their active status, and trigger test
// pings to verify the connection before an event goes live.
    // =============================================================================

    import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export type IntegrationPlatform = 'discord' | 'slack' | 'microsoft_teams';

export interface ClubIntegration {
    id: string;
    club_id: string;
    platform: IntegrationPlatform;
    webhook_url: string;
    channel_name: string | null;
    is_active: boolean;
    last_tested_at: string | null;
    last_test_status: string | null;
}

interface UseClubIntegrationsReturn {
    integrations: ClubIntegration[];
    isLoading: boolean;
    isTesting: string | null; // ID of the integration currently being tested
    error: string | null;
    addIntegration: (platform: IntegrationPlatform, url: string, channel: string) => Promise<boolean>;
    toggleActive: (id: string, isActive: boolean) => Promise<void>;
    deleteIntegration: (id: string) => Promise<void>;
    testIntegration: (id: string) => Promise<boolean>;
}

export function useClubIntegrations(clubId: string | null): UseClubIntegrationsReturn {
    const [integrations, setIntegrations] = useState<ClubIntegration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTesting, setIsTesting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchIntegrations = useCallback(async () => {
        if (!clubId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const { data, error: fetchError } = await supabase
                .from('club_integrations')
                .select('*')
                .eq('club_id', clubId)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            setIntegrations((data as ClubIntegration[]) || []);
        } catch (err: any) {
            console.error('[useClubIntegrations] Fetch failed:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [clubId]);

    useEffect(() => {
        fetchIntegrations();
    }, [fetchIntegrations]);

    const addIntegration = async (platform: IntegrationPlatform, url: string, channel: string): Promise<boolean> => {
        if (!clubId) return false;
        setError(null);

        try {
            // Basic URL validation
            new URL(url);
            if (!url.includes('discord.com/api/webhooks') && !url.includes('hooks.slack.com')) {
                throw new Error('Invalid webhook URL. Please use a valid Discord or Slack webhook.');
            }

            const { error: insertError } = await supabase
                .from('club_integrations')
                .insert({
                    club_id: clubId,
                    platform,
                    webhook_url: url,
                    channel_name: channel || null,
                    is_active: true
                });

            if (insertError) throw insertError;
            await fetchIntegrations();
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to add integration.');
            return false;
        }
    };

    const toggleActive = async (id: string, isActive: boolean) => {
        try {
            await supabase
                .from('club_integrations')
                .update({ is_active: isActive })
                .eq('id', id);

            setIntegrations(prev => prev.map(i => i.id === id ? { ...i, is_active: isActive } : i));
        } catch (err: any) {
            console.error('[useClubIntegrations] Toggle failed:', err);
        }
    };

    const deleteIntegration = async (id: string) => {
        try {
            await supabase.from('club_integrations').delete().eq('id', id);
            setIntegrations(prev => prev.filter(i => i.id !== id));
        } catch (err: any) {
            console.error('[useClubIntegrations] Delete failed:', err);
        }
    };

    const testIntegration = async (id: string): Promise<boolean> => {
        setIsTesting(id);
        try {
            const { data, error: fnError } = await supabase.functions.invoke('crosspost-event', {
                body: { integration_id: id, is_test: true }
            });

            if (fnError) throw fnError;

            // Refetch to get updated test status
            await fetchIntegrations();
            return true;
        } catch (err: any) {
            console.error('[useClubIntegrations] Test failed:', err);
            setError('Failed to send test ping.');
            return false;
        } finally {
            setIsTesting(null);
        }
    };

    return {
        integrations,
        isLoading,
        isTesting,
        error,
        addIntegration,
        toggleActive,
        deleteIntegration,
        testIntegration
    };
}
