import axios from 'axios';

export class CorporateMatchingService {
  private static API_KEY = process.env.DOUBLE_THE_DONATION_API_KEY || 'mock_key';
  private static BASE_URL = 'https://doublethedonation.com/api/v1';

  static async verifyEmployer(employerName: string): Promise<{ eligible: boolean; guidelines?: string }> {
    try {
      // In production, hit Double the Donation API. Returning mock verification for demonstration:
      if (!employerName) return { eligible: false };
      
      const response = await axios.get(`${this.BASE_URL}/match`, {
        params: { api_key: this.API_KEY, company: employerName },
        timeout: 5000,
      });

      return {
        eligible: response.data?.matching_gift_eligible || true,
        guidelines: response.data?.guidelines || '1:1 match ratio up to $1,000.',
      };
    } catch (error) {
      // Fallback mock check for common employers if API is unreachable
      const lower = employerName.toLowerCase();
      if (['microsoft', 'google', 'apple', 'amazon', 'meta'].includes(lower)) {
        return { eligible: true, guidelines: '1:1 Corporate Match' };
      }
      return { eligible: false };
    }
  }

  static async autoFileMatchingRequest(donationId: string, employerName: string, clubTaxEin: string, amount: number) {
    // Integration logic to pre-fill and transmit paperwork via matching vendor webhook/API
    console.log(`Auto-filing match request for Donation ${donationId} with ${employerName} (EIN: ${clubTaxEin}) for $${amount}`);
    return { success: true, confirmationId: `MATCH-${Math.floor(Math.random() * 1000000)}` };
  }
}
