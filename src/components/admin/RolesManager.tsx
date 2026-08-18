// =============================================================================
// Component: RolesManager
--Issue: #2896 - Implement Role - Based Access Control(RBAC) UI for Club Executives
--Description: Dashboard for the Club President to create, edit, and delete
    --custom roles.Integrates with the PermissionsMatrix to toggle specific
--capabilities for each role.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AppPermission, PERMISSION_METADATA } from '../../../lib/rbac/permissionGuards';
import { PermissionsMatrix } from './PermissionsMatrix';

interface ClubRole {
    id: string;
    name: string;
    is_system_role: boolean;
    permissions: AppPermission[];
}

interface RolesManagerProps {
    clubId: string;
}

export const RolesManager: React.FC<RolesManagerProps> = ({ clubId }) => {
    const [roles, setRoles] = useState<ClubRole[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRoles();
    }, [clubId]);

    const fetchRoles = async () => {
        setIsLoading(true);
        try {
            const { data, error: fetchError } = await supabase
                .from('club_roles')
                .select(`
          id,
          name,
          is_system_role,
          club_role_permissions (permission)
        `)
                .eq('club_id', clubId)
                .order('is_system_role', { ascending: false })
                .order('name');

            if (fetchError) throw fetchError;

            const formattedRoles: ClubRole[] = (data || []).map((role: any) => ({
                id: role.id,
                name: role.name,
                is_system_role: role.is_system_role,
                permissions: (role.club_role_permissions || []).map((p: any) => p.permission as AppPermission)
            }));

            setRoles(formattedRoles);
            if (formattedRoles.length > 0 && !selectedRoleId) {
                setSelectedRoleId(formattedRoles[0].id);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateRole = async () => {
        if (!newRoleName.trim()) return;
        setIsSaving(true);
        try {
            const { data, error: insertError } = await supabase
                .from('club_roles')
                .insert({ club_id: clubId, name: newRoleName.trim(), is_system_role: false })
                .select('id')
                .single();

            if (insertError) throw insertError;

            setNewRoleName('');
            await fetchRoles();
            setSelectedRoleId(data.id);
        } catch (err: any) {
            setError(err.message.includes('duplicate') ? 'A role with this name already exists.' : err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRole = async (roleId: string) => {
        if (!confirm('Are you sure you want to delete this role? Members assigned to it will lose their permissions.')) return;

        try {
            const { error: deleteError } = await supabase
                .from('club_roles')
                .delete()
                .eq('id', roleId);

            if (deleteError) throw deleteError;

            if (selectedRoleId === roleId) setSelectedRoleId(null);
            await fetchRoles();
        } catch (err: any) {
            setError(err.message.includes('Cannot delete system roles') ? 'Cannot delete the President role.' : err.message);
        }
    };

    const handlePermissionsChange = async (roleId: string, newPermissions: AppPermission[]) => {
        // Optimistic update
        setRoles(prev => prev.map(r => r.id === roleId ? { ...r, permissions: newPermissions } : r));

        try {
            // 1. Delete all existing permissions for this role
            await supabase.from('club_role_permissions').delete().eq('role_id', roleId);

            // 2. Insert the new set of permissions
            if (newPermissions.length > 0) {
                const inserts = newPermissions.map(p => ({ role_id: roleId, permission: p }));
                const { error: insertError } = await supabase.from('club_role_permissions').insert(inserts);
                if (insertError) throw insertError;
            }
        } catch (err: any) {
            setError('Failed to update permissions: ' + err.message);
            await fetchRoles(); // Revert on error
        }
    };

    const selectedRole = roles.find(r => r.id === selectedRoleId);

    if (isLoading) {
        return <div className="animate-pulse h-64 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>;
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Roles & Permissions</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Define custom roles and granular access levels for your executive team.
                </p>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border-b border-red-100 dark:border-red-900">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:divide-x md:divide-gray-200 dark:md:divide-gray-700">
                {/* Left Sidebar: Roles List */}
                <div className="p-4 bg-gray-50/50 dark:bg-gray-900/30">
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                            Create New Role
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                                placeholder="e.g., Treasurer"
                                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateRole()}
                            />
                            <button
                                onClick={handleCreateRole}
                                disabled={isSaving || !newRoleName.trim()}
                                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        {roles.map(role => (
                            <button
                                key={role.id}
                                onClick={() => setSelectedRoleId(role.id)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group ${selectedRoleId === role.id
                                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                            >
                                <span className="truncate">{role.name}</span>
                                {!role.is_system_role && (
                                    <svg
                                        onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                                        className="w-4 h-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right Content: Permissions Matrix */}
                <div className="md:col-span-2 p-6">
                    {selectedRole ? (
                        <PermissionsMatrix
                            roleId={selectedRole.id}
                            roleName={selectedRole.name}
                            currentPermissions={selectedRole.permissions}
                            isSystemRole={selectedRole.is_system_role}
                            onSave={(perms) => handlePermissionsChange(selectedRole.id, perms)}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                            Select a role to manage its permissions.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
