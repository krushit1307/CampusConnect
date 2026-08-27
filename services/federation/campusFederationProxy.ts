import { CampusTenantInfo } from './types';

export class CampusFederationProxy {
  private tenantCache: Map<string, CampusTenantInfo> = new Map();

  async resolveTenant(domain: string): Promise<CampusTenantInfo | null> {
    if (this.tenantCache.has(domain)) {
      return this.tenantCache.get(domain)!;
    }

    // In a real system, query the database: 
    // const tenant = await db.campusTenant.findUnique({ where: { domain } });
    const tenant: CampusTenantInfo | null = {
      id: `tenant_${Date.now()}`,
      domain,
      apiEndpoint: `https://api.${domain}/v1`,
      publicKey: 'MOCK_PUBLIC_KEY'
    }; // Simulated database resolution

    if (tenant) {
      this.tenantCache.set(domain, tenant);
    }

    return tenant;
  }

  async proxyRequest(domain: string, path: string, options: RequestInit): Promise<Response> {
    const tenant = await this.resolveTenant(domain);
    if (!tenant) {
      throw new Error(`Tenant not found for domain: ${domain}`);
    }

    const url = `${tenant.apiEndpoint}${path}`;
    return fetch(url, options);
  }
}
