import React from 'react';

/**
 * Conditionally renders children based on whether the user possesses the required scope.
 */
export function PermissionGuard({ userPermissions = [], requiredScope, fallback = null, children }) {
  const hasAccess = userPermissions.includes(requiredScope) || userPermissions.includes('*');

  if (!hasAccess) {
    return fallback;
  }

  return <>{children}</>;
}
