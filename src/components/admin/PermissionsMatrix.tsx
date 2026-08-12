// =============================================================================
// Component: PermissionsMatrix
--Issue: #2896 - Implement Role - Based Access Control(RBAC) UI for Club Executives
--Description: Renders a grid of toggles for every available permission in
    --the system.Groups them by category and prevents the removal of critical
--permissions from system roles(like President).
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
    AppPermission,
    PERMISSION_METADATA,
    PERMISSION_CATEGORIES
} from '../../../lib/rbac/permissionGuards';

interface PermissionsMatrixProps {
    roleId: string;
    roleName: string;
    currentPermissions: AppPermission[];
    isSystemRole: boolean;
    onSave: (permissions: AppPermission[]) => void;
}

export const PermissionsMatrix: React.FC<PermissionsMatrixProps> = ({
    roleName,
    currentPermissions,
    isSystemRole,
    onSave
}) => {
    const [selectedPerms, setSelectedPerms] = useState<Set<AppPermission>>(new Set(currentPermissions));
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setSelectedPerms(new Set(currentPermissions));
        setHasChanges(false);
    }, [currentPermissions, roleName]);

    const togglePermission = (perm: AppPermission) => {
        // Lockout prevention: Cannot remove 'can_manage_roles' from a system role 
        // if it's the only way to manage roles (simplified logic for UI)
        if (isSystemRole && perm === 'can_manage_roles' && selectedPerms.has(perm)) {
            alert('Cannot remove "Manage Roles" from the President role. This would lock you out of the admin panel.');
            return;
        }

        setSelectedPerms(prev => {
            const next = new Set(prev);
            if (next.has(perm)) {
                next.delete(perm);
            } else {
                next.add(perm);
            }
            return next;
        });
        setHasChanges(true);
    };

    const handleSave = () => {
        onSave(Array.from(selectedPerms));
        setHasChanges(false);
    };

    const handleSelectAll = (categoryPerms: AppPermission[]) => {
        setSelectedPerms(prev => {
            const next = new Set(prev);
            categoryPerms.forEach(p => next.add(p));
            return next;
        });
        setHasChanges(true);
    };

    const handleClearAll = (categoryPerms: AppPermission[]) => {
        setSelectedPerms(prev => {
            const next = new Set(prev);
            categoryPerms.forEach(p => {
                // Protect system role locks
                if (!(isSystemRole && p === 'can_manage_roles')) {
                    next.delete(p);
                }
            });
            return next;
        });
        setHasChanges(true);
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Permissions for: <span className="text-indigo-600 dark:text-indigo-400">{roleName}</span>
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {selectedPerms.size} of {Object.keys(PERMISSION_METADATA).length} permissions enabled.
                    </p>
                </div>

                {hasChanges && (
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save Changes
                    </button>
                )}
            </div>

            {PERMISSION_CATEGORIES.map(category => {
                const categoryPerms = (Object.keys(PERMISSION_METADATA) as AppPermission[])
                    .filter(p => PERMISSION_METADATA[p].category === category);

                if (categoryPerms.length === 0) return null;

                return (
                    <div key={category} className="space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                {category}
                            </h4>
                            <div className="flex gap-3 text-xs">
                                <button
                                    onClick={() => handleSelectAll(categoryPerms)}
                                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                                >
                                    Enable All
                                </button>
                                <button
                                    onClick={() => handleClearAll(categoryPerms)}
                                    className="text-gray-500 dark:text-gray-400 hover:underline font-medium"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                            {categoryPerms.map(perm => {
                                const meta = PERMISSION_METADATA[perm];
                                const isChecked = selectedPerms.has(perm);
                                const isLocked = isSystemRole && perm === 'can_manage_roles';

                                return (
                                    <label
                                        key={perm}
                                        className={`
                      flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer
                      ${isChecked
                                                ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                            }
                      ${isLocked ? 'opacity-75 cursor-not-allowed' : ''}
                    `}
                                    >
                                        <div className="pt-0.5">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => togglePermission(perm)}
                                                disabled={isLocked}
                                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {meta.label}
                                                </span>
                                                {isLocked && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400 rounded">
                                                        Protected
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                {meta.description}
                                            </p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
