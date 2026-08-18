export interface SellerMetadataDTO {
  sellerId: string;
  sellerName: string;
  studentEmail: string;
  campusVerificationStatus: boolean;
  positiveFeedbackCount: number;
}

export class MarketplaceListingModel {
  public id: string;
  public itemTitle: string;
  public category: 'Electronics' | 'Textbooks' | 'Furniture' | 'Bicycles & Gear' | 'Housing Sublets';
  public itemCondition: 'Brand New' | 'Like New' | 'Very Good' | 'Good' | 'Fair';
  public listingPriceUSD: number;
  public originalRetailPriceUSD?: number;
  public pickupLocation: string;
  public seller: SellerMetadataDTO;
  public tags: string[];
  public status: 'ACTIVE' | 'PENDING_HANDSHAKE' | 'SOLD';
  public createdAt: string;

  constructor(data: Partial<MarketplaceListingModel>) {
    this.id = data.id || `itm_${Math.random().toString(36).substr(2, 9)}`;
    this.itemTitle = data.itemTitle || 'Untitled Campus Item';
    this.category = data.category || 'Electronics';
    this.itemCondition = data.itemCondition || 'Like New';
    this.listingPriceUSD = data.listingPriceUSD || 0;
    this.originalRetailPriceUSD = data.originalRetailPriceUSD;
    this.pickupLocation = data.pickupLocation || 'Student Union Lobby';
    this.seller = data.seller || {
      sellerId: 'usr_seller_10',
      sellerName: 'Campus Student',
      studentEmail: 'student@campus.edu',
      campusVerificationStatus: true,
      positiveFeedbackCount: 15,
    };
    this.tags = data.tags || [];
    this.status = data.status || 'ACTIVE';
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  public toJSON() {
    return {
      id: this.id,
      itemTitle: this.itemTitle,
      category: this.category,
      itemCondition: this.itemCondition,
      listingPriceUSD: this.listingPriceUSD,
      originalRetailPriceUSD: this.originalRetailPriceUSD,
      pickupLocation: this.pickupLocation,
      seller: this.seller,
      tags: this.tags,
      status: this.status,
      createdAt: this.createdAt,
    };
  }
}
