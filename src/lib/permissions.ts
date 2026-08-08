// Binary powers of 2 for permissions
export const PERMISSIONS = {
  NONE: 0, // 0000
  CREATE_EVENT: 1, // 0001 (1 << 0)
  DELETE_EVENT: 2, // 0010 (1 << 1)
  MANAGE_USERS: 4, // 0100 (1 << 2)
  MANAGE_FINANCE: 8, // 1000 (1 << 3)
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

/**
 * Check if a permission bitmask includes a required permission.
 */
export function hasPermission(mask: number, requiredPermission: number): boolean {
  return (mask & requiredPermission) === requiredPermission;
}

/**
 * Grant a permission to an existing bitmask (Bitwise OR).
 */
export function addPermission(mask: number, permissionToAdd: number): number {
  return mask | permissionToAdd;
}

/**
 * Revoke a permission from an existing bitmask (Bitwise AND NOT).
 */
export function removePermission(mask: number, permissionToRemove: number): number {
  return mask & ~permissionToRemove;
}
