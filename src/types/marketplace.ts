export type ListingCategory = 'textbooks' | 'electronics' | 'sublets' | 'furniture' | 'supplies' | 'services';
export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair';
export type ListingType = 'fixed' | 'auction';

export interface Bid {
  id: string;
  listingId: string;
  bidderId: string;
  bidderName: string;
  bidderAvatar?: string;
  amount: number;
  createdAt: string;
}

export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  category: ListingCategory;
  condition: ListingCondition;
  type: ListingType;
  price: number; // For fixed or starting bid
  currentBid?: number;
  bids: Bid[];
  auctionEndsAt?: string;
  images: string[];
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  location: string;
  status: 'active' | 'sold' | 'expired';
  createdAt: string;
  escrowProtected: boolean;
}
