import { describe, it, expect } from "vitest";
import {
  scopeToTenant,
  validateTenantAccess,
  DEFAULT_TENANT_ID,
  TenantContext,
} from "./multiTenancy";

describe("Multi-Tenancy Isolation Suite (#2674)", () => {
  const tenantA: TenantContext = {
    tenantId: "11111111-1111-1111-1111-111111111111",
    slug: "mit",
  };

  const tenantB: TenantContext = {
    tenantId: "22222222-2222-2222-2222-222222222222",
    slug: "stanford",
  };

  const superAdmin: TenantContext = {
    tenantId: DEFAULT_TENANT_ID,
    slug: "global",
    isSuperAdmin: true,
  };

  it("injects tenant_id into database mutation payloads", () => {
    const rawEventPayload = { title: "Hackathon", capacity: 100 };
    const scoped = scopeToTenant(rawEventPayload, tenantA.tenantId);

    expect(scoped.tenant_id).toBe(tenantA.tenantId);
    expect(scoped.title).toBe("Hackathon");
  });

  it("allows access for matching tenant_id and blocks cross-tenant queries", () => {
    const resourceTenantId = tenantA.tenantId;

    // User from Tenant A accessing Tenant A resource -> TRUE
    expect(validateTenantAccess(resourceTenantId, tenantA)).toBe(true);

    // User from Tenant B accessing Tenant A resource -> FALSE
    expect(validateTenantAccess(resourceTenantId, tenantB)).toBe(false);
  });

  it("allows super admins to bypass tenant boundary checks", () => {
    const resourceTenantId = tenantB.tenantId;
    expect(validateTenantAccess(resourceTenantId, superAdmin)).toBe(true);
  });
});
