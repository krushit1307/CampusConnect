import { NextResponse } from 'next/server';
import { FederatedQueryAggregator } from '../../../../../../services/federation/federatedQueryAggregator';
import { TenantJwtValidator } from '../../../../../../services/federation/tenantJwtValidator';

const aggregator = new FederatedQueryAggregator();
const jwtValidator = new TenantJwtValidator();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const tenants = searchParams.get('tenants')?.split(',') || [];
    
    // Cross-tenant auth check (if token is provided)
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const issuerDomain = request.headers.get('X-Issuer-Domain');
      
      if (issuerDomain) {
        const payload = await jwtValidator.validateCrossTenantToken(token, issuerDomain);
        if (!payload) {
          return NextResponse.json({ error: 'Unauthorized federation token' }, { status: 401 });
        }
      }
    }

    const results = await aggregator.aggregateEventSearch({
      search,
      tenantIds: tenants.length > 0 ? tenants : undefined,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0')
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error('Federation API Error:', error);
    return NextResponse.json(
      { error: 'Federation request failed' },
      { status: 500 }
    );
  }
}
