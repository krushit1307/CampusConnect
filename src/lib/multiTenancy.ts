export interface TenantContext {
  tenantId: string;
  slug: string;
  isSuperAdmin?: boolean;
}

export const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Ensures database payload is scoped to the target tenant_id.
 */
export function scopeToTenant<T extends Record<string, unknown>>(
  payload: T,
  tenantId: string = DEFAULT_TENANT_ID,
): T & { tenant_id: string } {
  return {
    ...payload,
    tenant_id: tenantId,
  };
}

/**
 * Validates whether a resource record belongs to the active tenant session.
 */
export function validateTenantAccess(
  resourceTenantId: string,
  userTenantContext: TenantContext,
): boolean {
  if (userTenantContext.isSuperAdmin) return true;
  return resourceTenantId === userTenantContext.tenantId;
}
