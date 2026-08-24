/**
 * Campus Marketplace — Type Definitions
 *
 * Buy/sell listings, textbook exchange, electronics, services,
 * transaction tracking, and marketplace analytics.
 */

export const LISTING_CATEGORIES = [
  'Textbooks', 'Electronics', 'Furniture', 'Clothing', 'Services',
  'Tutoring', 'Rideshare', 'Free Items', 'Event Tickets', 'Food & Drinks',
] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const LISTING_STATUSES = ['Active', 'Sold', 'Reserved', 'Expired', 'Removed'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const CONDITION_LEVELS = ['New', 'Like New', 'Good', 'Fair', 'Poor'] as const;
export type ConditionLevel = (typeof CONDITION_LEVELS)[number];

export const PAYMENT_METHODS = ['Cash', 'Venmo', 'Zelle', 'Campus Points', 'Barter'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TRANSACTION_STATUSES = ['Pending', 'Completed', 'Disputed', 'Refunded'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

// ── Color Maps ─────────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<ListingCategory, string> = {
  'Textbooks': '#3b82f6', 'Electronics': '#8b5cf6', 'Furniture': '#22c55e',
  'Clothing': '#ec4899', 'Services': '#f59e0b', 'Tutoring': '#06b6d4',
  'Rideshare': '#14b8a6', 'Free Items': '#a855f7', 'Event Tickets': '#f97316',
  'Food & Drinks': '#ef4444',
};

export const CONDITION_COLORS: Record<ConditionLevel, string> = {
  'New': '#22c55e', 'Like New': '#86efac', 'Good': '#eab308',
  'Fair': '#f97316', 'Poor': '#ef4444',
};

export const STATUS_COLORS: Record<ListingStatus, string> = {
  'Active': '#22c55e', 'Sold': '#6b7280', 'Reserved': '#eab308',
  'Expired': '#ef4444', 'Removed': '#9ca3af',
};

export const CATEGORY_ICONS: Record<ListingCategory, string> = {
  'Textbooks': '📖', 'Electronics': '💻', 'Furniture': '🪑', 'Clothing': '👕',
  'Services': '🔧', 'Tutoring': '🎓', 'Rideshare': '🚗', 'Free Items': '🎁',
  'Event Tickets': '🎫', 'Food & Drinks': '🍕',
};

// ── Core Types ─────────────────────────────────────────────────────────────

export interface Listing {
  id: string;
  title: string;
  description: string;
  category: ListingCategory;
  status: ListingStatus;
  condition: ConditionLevel;
  price: number;
  originalPrice?: number;
  currency: string;
  sellerId: string;
  sellerName: string;
  sellerRating: number;
  images: string[];
  tags: string[];
  location: string;
  isNegotiable: boolean;
  postedAt: string;
  expiresAt: string;
  viewCount: number;
  saveCount: number;
  inquiryCount: number;
}

export interface Transaction {
  id: string;
  listingId: string;
  listingTitle: string;
  category: ListingCategory;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  completedAt: string;
  rating?: number; // 1-5
  review?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  listingsCount: number;
  purchasesCount: number;
  rating: number;
  totalEarnings: number;
  totalSpent: number;
  joinDate: string;
  isVerified: boolean;
}

export interface MarketplaceTrend {
  month: string;
  newListings: number;
  totalSales: number;
  totalRevenue: number;
  avgPrice: number;
  activeUsers: number;
}

export interface CategoryStats {
  category: ListingCategory;
  listingsCount: number;
  soldCount: number;
  avgPrice: number;
  totalRevenue: number;
  avgTimeToSell: number; // days
}

export interface MarketplaceInsight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'warning' | 'critical' | 'info';
  metric: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
}

export interface MarketplaceSummary {
  totalListings: number;
  activeListings: number;
  soldListings: number;
  totalTransactions: number;
  totalRevenue: number;
  avgListingPrice: number;
  avgTimeToSell: number;
  topCategory: ListingCategory;
  activeSellers: number;
  repeatBuyers: number;
}

// ── Formatters ─────────────────────────────────────────────────────────────

export function formatPrice(price: number): string {
  return price === 0 ? 'Free' : `$${price.toFixed(2)}`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTimeAgo(date: string): string {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
