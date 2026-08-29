export interface SponsorLedgerItem {
  transactionId: string;
  vendorName: string;
  category: string;
  amount: number;
  transactionDateIso: string;
  receiptOcrUrl?: string | null;
  isVerified: boolean;
}

export interface SankeyDataNode {
  name: string;
}

export interface SankeyDataLink {
  source: number; // Node index
  target: number; // Node index
  value: number;
}

export interface SponsorRoiSummary {
  sponsorshipId: string;
  companyName: string;
  totalSponsoredAmount: number;
  totalSpentAmount: number;
  remainingBalance: number;
  allocationBreakdown: Record<string, number>;
  transactions: SponsorLedgerItem[];
  sankeyData: {
    nodes: SankeyDataNode[];
    links: SankeyDataLink[];
  };
}

/**
 * Aggregates tagged sponsorship transactions into clean financial breakdowns and Sankey chart data formats.
 */
export function buildSponsorRoiSummary(
  sponsorshipId: string,
  companyName: string,
  totalSponsoredAmount: number,
  transactions: SponsorLedgerItem[],
): SponsorRoiSummary {
  let totalSpentAmount = 0;
  const categoryTotals: Record<string, number> = {};

  for (const tx of transactions) {
    totalSpentAmount += tx.amount;
    const cat = tx.category || "Uncategorized";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + tx.amount;
  }

  totalSpentAmount = Number(totalSpentAmount.toFixed(2));
  const remainingBalance = Number(Math.max(0, totalSponsoredAmount - totalSpentAmount).toFixed(2));

  // Construct Sankey nodes & links (Source: Sponsor Funds -> Categories)
  const nodes: SankeyDataNode[] = [{ name: companyName }];
  const links: SankeyDataLink[] = [];

  const categories = Object.keys(categoryTotals);
  categories.forEach((cat, index) => {
    nodes.push({ name: cat });
    links.push({
      source: 0,
      target: index + 1,
      value: Number(categoryTotals[cat].toFixed(2)),
    });
  });

  if (remainingBalance > 0) {
    nodes.push({ name: "Unallocated Balance" });
    links.push({
      source: 0,
      target: nodes.length - 1,
      value: remainingBalance,
    });
  }

  return {
    sponsorshipId,
    companyName,
    totalSponsoredAmount,
    totalSpentAmount,
    remainingBalance,
    allocationBreakdown: categoryTotals,
    transactions,
    sankeyData: { nodes, links },
  };
}

/**
 * Verifies whether a transaction has a valid OCR receipt image linked for auditing.
 */
export function getReceiptAuditStatus(tx: SponsorLedgerItem): {
  isAudited: boolean;
  badgeLabel: string;
  badgeCss: string;
} {
  if (tx.receiptOcrUrl && tx.receiptOcrUrl.trim().length > 0) {
    return {
      isAudited: true,
      badgeLabel: "Verified OCR Receipt",
      badgeCss: "bg-green-100 text-green-800 border-green-200",
    };
  }

  return {
    isAudited: false,
    badgeLabel: "Pending Receipt",
    badgeCss: "bg-yellow-100 text-yellow-800 border-yellow-200",
  };
}
