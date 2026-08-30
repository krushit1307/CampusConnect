/**
 * Enterprise Campus Alumni Endowment & Crowdfunding Service
 * Provides alumni donation processing, campaign goal tracking, gift matching,
 * endowment payout scheduling, and donor leaderboard analytics.
 */

export interface EndowmentCampaign {
  id: string;
  title: string;
  category: 'SCHOLARSHIP' | 'RESEARCH_LAB' | 'INFRASTRUCTURE' | 'ATHLETICS' | 'STUDENT_EMERGENCY';
  targetAmount: number;
  raisedAmount: number;
  donorCount: number;
  matchingGrantRatio: number; // e.g. 1.5x matching by corporate sponsor
  matchingSponsorName?: string;
  deadline: string;
  status: 'ACTIVE' | 'FUNDED' | 'EXPIRED';
  description: string;
  createdAt: string;
}

export interface AlumniDonationTransaction {
  id: string;
  campaignId: string;
  donorName: string;
  donorGraduationYear: number;
  amount: number;
  matchedAmount: number;
  isAnonymous: boolean;
  paymentMethod: 'CREDIT_CARD' | 'BANK_TRANSFER' | 'CRYPTO' | 'STOCK_TRANSFER';
  timestamp: string;
}

export class CampusAlumniEndowmentService {
  private static campaigns: EndowmentCampaign[] = [
    {
      id: 'CAMP-ENDOW-01',
      title: 'Stem Opportunity Underrepresented Student Scholarship',
      category: 'SCHOLARSHIP',
      targetAmount: 250000,
      raisedAmount: 185400,
      donorCount: 342,
      matchingGrantRatio: 2.0,
      matchingSponsorName: 'Silicon Valley Foundation',
      deadline: '2026-12-31',
      status: 'ACTIVE',
      description: 'Providing full-ride tuition support for underrepresented undergraduate students in computer science and engineering.',
      createdAt: '2026-08-01 10:00:00',
    },
    {
      id: 'CAMP-ENDOW-02',
      title: 'Quantum Computing Research Lab Supercomputer Fund',
      category: 'RESEARCH_LAB',
      targetAmount: 500000,
      raisedAmount: 412000,
      donorCount: 189,
      matchingGrantRatio: 1.5,
      matchingSponsorName: 'NVIDIA Higher Ed Grant Initiative',
      deadline: '2026-10-15',
      status: 'ACTIVE',
      description: 'Acquiring liquid-cooled GPU clusters for student-led quantum AI model training and bio-computing simulations.',
      createdAt: '2026-08-05 14:30:00',
    },
  ];

  private static transactions: AlumniDonationTransaction[] = [
    {
      id: 'DON-TX-901',
      campaignId: 'CAMP-ENDOW-01',
      donorName: 'Dr. Sarah Jenkins',
      donorGraduationYear: 2012,
      amount: 5000,
      matchedAmount: 10000,
      isAnonymous: false,
      paymentMethod: 'CREDIT_CARD',
      timestamp: '2026-08-20 16:45:00',
    },
  ];

  public static getActiveCampaigns(): EndowmentCampaign[] {
    return this.campaigns;
  }

  public static getCampaignById(id: string): EndowmentCampaign | undefined {
    return this.campaigns.find((c) => c.id === id);
  }

  public static processDonation(
    campaignId: string,
    donorName: string,
    donorGraduationYear: number,
    amount: number,
    isAnonymous: boolean,
    paymentMethod: 'CREDIT_CARD' | 'BANK_TRANSFER' | 'CRYPTO' | 'STOCK_TRANSFER'
  ): { transaction: AlumniDonationTransaction; campaign: EndowmentCampaign } {
    const campaign = this.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign with ID ${campaignId} not found.`);
    }

    const matchedAmount = amount * (campaign.matchingGrantRatio || 1.0);
    const totalAdded = amount + matchedAmount;

    campaign.raisedAmount += totalAdded;
    campaign.donorCount += 1;
    if (campaign.raisedAmount >= campaign.targetAmount) {
      campaign.status = 'FUNDED';
    }

    const transaction: AlumniDonationTransaction = {
      id: `DON-TX-${Date.now()}`,
      campaignId,
      donorName: isAnonymous ? 'Anonymous Alumni Donor' : donorName,
      donorGraduationYear,
      amount,
      matchedAmount,
      isAnonymous,
      paymentMethod,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    this.transactions.unshift(transaction);
    return { transaction, campaign };
  }

  public static getDonationHistory(campaignId?: string): AlumniDonationTransaction[] {
    if (campaignId) {
      return this.transactions.filter((t) => t.campaignId === campaignId);
    }
    return this.transactions;
  }

  public static calculateTotalImpactMetrics() {
    const totalRaised = this.campaigns.reduce((acc, c) => acc + c.raisedAmount, 0);
    const totalDonors = this.campaigns.reduce((acc, c) => acc + c.donorCount, 0);
    const fundedCount = this.campaigns.filter((c) => c.status === 'FUNDED').length;

    return {
      totalRaised,
      totalDonors,
      fundedCount,
      activeCampaignsCount: this.campaigns.length,
    };
  }
}
