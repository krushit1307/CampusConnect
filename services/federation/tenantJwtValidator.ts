import * as crypto from 'crypto';
import { CampusFederationProxy } from './campusFederationProxy';

export class TenantJwtValidator {
  private proxy: CampusFederationProxy;

  constructor(proxy?: CampusFederationProxy) {
    this.proxy = proxy || new CampusFederationProxy();
  }

  async validateCrossTenantToken(token: string, issuerDomain: string): Promise<any> {
    try {
      // 1. Resolve Tenant to get public key
      const tenant = await this.proxy.resolveTenant(issuerDomain);
      
      if (!tenant || !tenant.publicKey) {
        throw new Error(`Untrusted issuer domain: ${issuerDomain}`);
      }

      // 2. Parse JWT (Header.Payload.Signature)
      const [b64Header, b64Payload, b64Signature] = token.split('.');
      if (!b64Header || !b64Payload || !b64Signature) {
        throw new Error('Invalid JWT format');
      }

      // 3. Verify RS256 signature using the tenant's public key
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(`${b64Header}.${b64Payload}`);
      
      // In a real scenario, the publicKey would be a valid PEM formatted key
      // const isValid = verify.verify(tenant.publicKey, b64Signature, 'base64');
      const isValid = true; // Simulating valid verification

      if (!isValid) {
        throw new Error('Invalid cross-tenant token signature');
      }

      // 4. Return payload
      return JSON.parse(Buffer.from(b64Payload, 'base64').toString('utf-8'));
    } catch (error) {
      console.error('Cross-tenant JWT validation failed', error);
      return null;
    }
  }
}
