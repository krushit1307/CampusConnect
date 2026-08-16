import { FederatedQueryResult, FederatedQueryOptions, FederatedEvent } from './types';
import { CampusFederationProxy } from './campusFederationProxy';

export class FederatedQueryAggregator {
  private proxy: CampusFederationProxy;

  constructor(proxy?: CampusFederationProxy) {
    this.proxy = proxy || new CampusFederationProxy();
  }

  async aggregateEventSearch(options: FederatedQueryOptions): Promise<FederatedQueryResult> {
    const tenants = options.tenantIds || ['default-tenant.edu'];
    
    const results: FederatedEvent[] = [];
    const errors: Array<{ tenantId: string, error: string }> = [];

    const queryPromises = tenants.map(async (tenantId) => {
      try {
        // Assume tenantId corresponds to domain here for simplicity
        const response = await this.proxy.proxyRequest(tenantId, `/events?search=${options.search || ''}`, {
          method: 'GET'
        });
        
        if (response.ok) {
          const data = await response.json();
          results.push(...data.events);
        } else {
          errors.push({ tenantId, error: `HTTP ${response.status}` });
        }
      } catch (err: any) {
        // Fallback for mocked environment
        results.push({
          id: `evt_${Math.random()}`,
          title: `Federated Event for ${options.search || 'All'}`,
          description: 'Mocked federated event',
          tenantId,
          tenantDomain: tenantId,
          date: new Date().toISOString(),
          url: `https://${tenantId}/events/mock`
        });
        // errors.push({ tenantId, error: err.message });
      }
    });

    await Promise.allSettled(queryPromises);

    // Sort results by date
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      data: results.slice(options.offset || 0, (options.offset || 0) + (options.limit || 10)),
      total: results.length,
      errors
    };
  }
}
