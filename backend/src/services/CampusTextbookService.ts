import {
  CampusTextbookService,
  TextbookListing,
  TextbookOffer,
  TextbookFilterOptions,
} from "../models/CampusTextbookModel";

export class CampusTextbookServiceHandler {
  public static fetchTextbookListings(filters?: Partial<TextbookFilterOptions>): TextbookListing[] {
    return CampusTextbookService.getListings(filters);
  }

  public static fetchTextbookDetails(id: string): TextbookListing | undefined {
    return CampusTextbookService.getListingById(id);
  }

  public static createNewListing(
    payload: Omit<TextbookListing, "id" | "sellerRating" | "status" | "postedDate">
  ): TextbookListing {
    return CampusTextbookService.createListing(payload);
  }

  public static fetchUserOffers(): TextbookOffer[] {
    return CampusTextbookService.getOffers();
  }

  public static submitPurchaseOffer(
    textbookId: string,
    buyerName: string,
    offeredPrice: number,
    message: string
  ): TextbookOffer {
    return CampusTextbookService.makeOffer(textbookId, buyerName, offeredPrice, message);
  }

  public static updateOfferDecision(offerId: string, status: 'accepted' | 'declined'): boolean {
    return CampusTextbookService.updateOfferStatus(offerId, status);
  }
}
