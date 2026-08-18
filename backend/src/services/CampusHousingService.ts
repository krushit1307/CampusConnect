import {
  CampusHousingService,
  HousingListing,
  HousingInquiry,
  HousingFilterOptions,
} from "../models/CampusHousingModel";

export class CampusHousingServiceHandler {
  public static fetchHousingListings(filters?: Partial<HousingFilterOptions>): HousingListing[] {
    return CampusHousingService.getListings(filters);
  }

  public static fetchHousingDetails(id: string): HousingListing | undefined {
    return CampusHousingService.getListingById(id);
  }

  public static createNewHousingListing(
    payload: Omit<HousingListing, "id" | "postedDate" | "isAvailable">
  ): HousingListing {
    return CampusHousingService.createListing(payload);
  }

  public static fetchUserInquiries(): HousingInquiry[] {
    return CampusHousingService.getInquiries();
  }

  public static submitSubleaseInquiry(
    housingId: string,
    applicantName: string,
    applicantEmail: string,
    moveInDate: string,
    message: string
  ): HousingInquiry {
    return CampusHousingService.submitInquiry(
      housingId,
      applicantName,
      applicantEmail,
      moveInDate,
      message
    );
  }

  public static updateInquiryDecision(inquiryId: string, status: 'accepted' | 'declined'): boolean {
    return CampusHousingService.updateInquiryStatus(inquiryId, status);
  }
}
