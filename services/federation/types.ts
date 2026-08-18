export interface CampusTenantInfo {
  id: string;
  domain: string;
  apiEndpoint: string;
  publicKey: string;
}

export interface FederatedQueryOptions {
  limit?: number;
  offset?: number;
  search?: string;
  tenantIds?: string[];
}

export interface FederatedEvent {
  id: string;
  title: string;
  description: string;
  tenantId: string;
  tenantDomain: string;
  date: string;
  url: string;
}

export interface FederatedQueryResult {
  data: FederatedEvent[];
  total: number;
  errors: Array<{ tenantId: string, error: string }>;
}
