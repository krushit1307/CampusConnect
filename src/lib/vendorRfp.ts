export type RfpCategory = "catering" | "dj_audio" | "photography" | "venue_decor" | "security";

export interface VendorRfp {
  id: string;
  club_id: string;
  event_id?: string | null;
  title: string;
  category: RfpCategory;
  description: string;
  budget_max: number;
  deadline: string;
  status: "open" | "awarded" | "closed";
  accepted_bid_id?: string | null;
  created_at?: string;
}

export interface RfpBid {
  id: string;
  rfp_id: string;
  vendor_name: string;
  vendor_email: string;
  vendor_user_id?: string | null;
  quoted_price: number;
  proposal_pdf_url?: string | null;
  notes?: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at?: string;
}

export const RFP_CATEGORIES: { category: RfpCategory; label: string }[] = [
  { category: "catering", label: "Catering & Banquet Food" },
  { category: "dj_audio", label: "DJ, Lighting & Audio" },
  { category: "photography", label: "Photography & Videography" },
  { category: "venue_decor", label: "Venue Decor & Furniture" },
  { category: "security", label: "Event Security & Logistics" },
];

/**
 * Computes cost savings and percentage compared to the maximum club budget (#3559).
 */
export function calculateBidSavings(
  budgetMax: number,
  quotedPrice: number,
): { savingsAmount: number; savingsPercent: number; isUnderBudget: boolean } {
  const budget = Math.max(0, budgetMax || 0);
  const quote = Math.max(0, quotedPrice || 0);

  const savingsAmount = Number((budget - quote).toFixed(2));
  const isUnderBudget = savingsAmount >= 0;
  const savingsPercent = budget > 0 ? Number(((savingsAmount / budget) * 100).toFixed(1)) : 0;

  return {
    savingsAmount,
    savingsPercent,
    isUnderBudget,
  };
}

/**
 * Ranks submitted vendor bids ascending by price/value (#3559).
 */
export function rankBidsByValue(bids: RfpBid[]): RfpBid[] {
  if (!bids || bids.length === 0) return [];
  return [...bids].sort((a, b) => a.quoted_price - b.quoted_price);
}

/**
 * Returns human-readable label for RFP category (#3559).
 */
export function formatRfpCategoryLabel(category: RfpCategory): string {
  const match = RFP_CATEGORIES.find((c) => c.category === category);
  return match ? match.label : "General Procurement";
}
