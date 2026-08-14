// =============================================================================
// Hook: useClubPermissions
--Issue: #2896 - Implement Role - Based Access Control(RBAC) UI for Club Executives
--Description: Fetches the current user's role and granular permissions for 
--a specific club.Caches the result to prevent excessive database queries
--when multiple components need to check permissions simultaneously.
    // =============================================================================

    import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AppPermission } from '../../lib/rbac/permissionGuards';

interface ClubRole {
    id: string;
    name: string;
    is_system_role: boolean;
}

interface UseClubPermissionsReturn {
    permissions: AppPermission[];
    currentRole: ClubRole | null;
    isLoading: boolean;
    error: string | null;
    refreshPermissions: () => Promise<void>;
}

// Simple in-memory cache to prevent redundant fetches across component mounts
const permissionsCache = new Map<string, { permissions: AppPermission[]; role: ClubRole | null; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

export function useClubPermissions(clubId: string | null): UseClubPermissionsReturn {
    const [permissions, setPermissions] = useState<AppPermission[]>([]);
    const [currentRole, setCurrentRole] = useState<ClubRole | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPermissions = useCallback(async () => {
        if (!clubId) {
            setIsLoading(false);
            return;
        }

        // Check cache first
        const cached = permissionsCache.get(clubId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            setPermissions(cached.permissions);
            setCurrentRole(cached.role);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setPermissions([]);
                setCurrentRole(null);
                setIsLoading(false);
                return;
            }

            // Fetch the user's membership record, including the linked role and its permissions
            const { data, error: fetchError } = await supabase
                .from('club_members')
                .select(`
          role_id,
          club_roles (
            id,
            name,
            is_system_role,
            club_role_permissions (permission)
          )
        `)
                .eq('user_id', user.id)
                .eq('club_id', clubId)
                .eq('status', 'approved')
                .maybeSingle();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            if (!data || !data.club_roles) {
                // User is not a member or has no role assigned
                setPermissions([]);
                setCurrentRole(null);
            } else {
                const role = data.club_roles as any;
                const perms: AppPermission[] = (role.club_role_permissions || []).map(
                    (p: any) => p.permission as AppPermission
                );

                const roleInfo: ClubRole = {
                    id: role.id,
                    name: role.name,
                    is_system_role: role.is_system_role
                };

                setPermissions(perms);
                setCurrentRole(roleInfo);

                // Update cache
                permissionsCache.set(clubId, {
                    permissions: perms,
                    role: roleInfo,
                    timestamp: Date.now()
                });
            }
        } catch (err: any) {
            console.error('[useClubPermissions] Fetch failed:', err);
            setError(err.message || 'Failed to load permissions');
        } finally {
            setIsLoading(false);
        }
    }, [clubId]);

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    const refreshPermissions = async () => {
        if (clubId) permissionsCache.delete(clubId);
        await fetchPermissions();
    };

    return {
        permissions,
        currentRole,
        isLoading,
        error,
        refreshPermissions
    };
}
