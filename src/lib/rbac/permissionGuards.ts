// =============================================================================
// Utility: RBAC Permission Guards & Types
// Issue: #2896 - Implement Role-Based Access Control (RBAC) UI for Club Executives
// Description: Defines the TypeScript types for all application permissions
// and provides utility functions to check permissions on the frontend,
// allowing the UI to gracefully hide unauthorized actions.
// =============================================================================

/**
 * Master list of all possible permissions in the CampusConnect system.
 * Must exactly match the `app_permission` ENUM in the Postgres database.
 */
export type AppPermission =
  | "can_edit_profile"
  | "can_manage_events"
  | "can_view_finances"
  | "can_manage_finances"
  | "can_manage_members"
  | "can_manage_roles"
  | "can_delete_club"
  | "can_moderate_forum";

/**
 * Human-readable labels and descriptions for the UI Permissions Matrix.
 */
export const PERMISSION_METADATA: Record<
  AppPermission,
  { label: string; description: string; category: string }
> = {
  can_edit_profile: {
    label: "Edit Club Profile",
    description: "Can update the club description, logo, banner, and social links.",
    category: "General",
  },
  can_manage_events: {
    label: "Manage Events",
    description: "Can create, edit, publish, and cancel club events.",
    category: "Events",
  },
  can_view_finances: {
    label: "View Finances",
    description: "Can view the club treasury balance and transaction history.",
    category: "Finance",
  },
  can_manage_finances: {
    label: "Manage Finances",
    description: "Can record expenses, approve reimbursements, and manage budgets.",
    category: "Finance",
  },
  can_manage_members: {
    label: "Manage Members",
    description: "Can approve join requests, remove members, and assign roles.",
    category: "Membership",
  },
  can_manage_roles: {
    label: "Manage Roles & Permissions",
    description: "Can create custom roles and modify the permission matrix.",
    category: "Administration",
  },
  can_delete_club: {
    label: "Delete Club",
    description: "Can permanently delete the club and all associated data.",
    category: "Administration",
  },
  can_moderate_forum: {
    label: "Moderate Forum",
    description: "Can delete posts, ban users, and pin announcements.",
    category: "Community",
  },
};

/**
 * Categories for grouping permissions in the UI matrix.
 */
export const PERMISSION_CATEGORIES = [
  "General",
  "Events",
  "Finance",
  "Membership",
  "Community",
  "Administration",
];

/**
 * Checks if a user's current permissions include a specific required permission.
 * Used by frontend components to conditionally render buttons or routes.
 *
 * @param userPermissions - Array of permission strings the user currently holds
 * @param required - The permission to check for
 * @returns boolean
 */
export function hasPermission(userPermissions: AppPermission[], required: AppPermission): boolean {
  return userPermissions.includes(required);
}

/**
 * Checks if a user has ALL of the specified permissions.
 */
export function hasAllPermissions(
  userPermissions: AppPermission[],
  required: AppPermission[],
): boolean {
  return required.every((p) => userPermissions.includes(p));
}

/**
 * Checks if a user has AT LEAST ONE of the specified permissions.
 */
export function hasAnyPermission(
  userPermissions: AppPermission[],
  required: AppPermission[],
): boolean {
  return required.some((p) => userPermissions.includes(p));
}
