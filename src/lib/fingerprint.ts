import FingerprintJS from "@fingerprintjs/fingerprintjs";

/**
 * Device Fingerprint Utility
 * Generates a stable, unique visitor ID based on browser hardware characteristics.
 * WARNING: This bypasses incognito mode. Use strictly for fraud-prevention endpoints
 * and ensure compliance with GDPR/CCPA via explicit Privacy Policy disclosure.
 */
class FingerprintService {
  private static instance: FingerprintService;
  private fpPromise: Promise<any> | null = null;

  private constructor() {}

  public static getInstance(): FingerprintService {
    if (!FingerprintService.instance) {
      FingerprintService.instance = new FingerprintService();
    }
    return FingerprintService.instance;
  }

  /**
   * Initializes the FingerprintJS agent.
   * Should be called once on application mount.
   */
  public async init(): Promise<void> {
    if (!this.fpPromise) {
      this.fpPromise = FingerprintJS.load({
        monitoring: false, // Disable continuous monitoring for privacy
      });
    }
    await this.fpPromise;
  }

  /**
   * Retrieves the unique visitor ID.
   * @returns A promise resolving to the hashed visitor ID string.
   */
  public async getVisitorId(): Promise<string> {
    if (!this.fpPromise) {
      await this.init();
    }
    const fp = await this.fpPromise!;
    const result = await fp.get();
    return result.visitorId;
  }

  /**
   * Clears the cached promise to force re-initialization (useful for testing).
   */
  public reset(): void {
    this.fpPromise = null;
  }
}

export const fingerprintService = FingerprintService.getInstance();
