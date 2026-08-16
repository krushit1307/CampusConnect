import crypto from 'crypto';

export class PDFSignatureVerifier {
  private static readonly SECRET_KEY = process.env.DOCUMENT_SIGNING_KEY || 'default_secure_signing_key_123';

  /**
   * Generates a deterministic SHA-256 HMAC signature for a document payload.
   */
  static generateSignature(documentBuffer: Buffer, metadata: Record<string, any>): string {
    const payload = documentBuffer.toString('base64') + JSON.stringify(metadata);
    return crypto
      .createHmac('sha256', this.SECRET_KEY)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verifies if the provided signature matches the document payload.
   */
  static verifySignature(documentBuffer: Buffer, metadata: Record<string, any>, signature: string): boolean {
    const expectedSignature = this.generateSignature(documentBuffer, metadata);
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
  }
}
