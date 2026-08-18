export interface HousingListing {
  id: string;
  title: string;
  propertyType: 'apartment' | 'studio' | 'shared-room' | 'house';
  monthlyRent: number;
  bedrooms: number;
  bathrooms: number;
  distanceToCampus: string;
  address: string;
  leaseTerm: 'Summer 2026' | 'Fall 2026' | 'Full Year' | 'Spring 2026';
  listerName: string;
  listerAvatar: string;
  listerRole: string;
  isVerifiedStudent: boolean;
  amenities: string[];
  description: string;
  images: string[];
  postedDate: string;
  isAvailable: boolean;
}

export interface HousingInquiry {
  id: string;
  housingId: string;
  propertyTitle: string;
  applicantName: string;
  applicantEmail: string;
  moveInDate: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  submittedDate: string;
}

export interface HousingFilterOptions {
  propertyType: string;
  maxRent: number;
  leaseTerm: string;
  searchQuery: string;
}

const INITIAL_HOUSING: HousingListing[] = [
  {
    id: "house-101",
    title: "Modern 2BR Apartment Sublease Near Science Quad",
    propertyType: "apartment",
    monthlyRent: 850,
    bedrooms: 2,
    bathrooms: 1,
    distanceToCampus: "5 min walk",
    address: "412 College Avenue, Apt 3B",
    leaseTerm: "Summer 2026",
    listerName: "Samantha Miller",
    listerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    listerRole: "Senior Bio student",
    isVerifiedStudent: true,
    amenities: ["In-unit Laundry", "Furnished", "High-speed Wi-Fi", "Balcony"],
    description: "Fully furnished 2-bedroom apartment available for summer sublease (May - August). Includes private desk setup, modern kitchen, and off-street parking.",
    images: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&auto=format&fit=crop&q=80"],
    postedDate: "2 days ago",
    isAvailable: true,
  },
  {
    id: "house-102",
    title: "Spacious Private Room in 4BR Student House",
    propertyType: "shared-room",
    monthlyRent: 620,
    bedrooms: 4,
    bathrooms: 2,
    distanceToCampus: "10 min bike",
    address: "789 Oakwood Drive",
    leaseTerm: "Fall 2026",
    listerName: "Jacob Thorne",
    listerAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    listerRole: "Junior Engineering student",
    isVerifiedStudent: true,
    amenities: ["Utilities Included", "Dishwasher", "Yard", "Pet Friendly"],
    description: "Large upstairs private bedroom in a quiet house shared with 3 CS & ECE upperclassmen. Looking for a clean roommate.",
    images: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&auto=format&fit=crop&q=80"],
    postedDate: "1 week ago",
    isAvailable: true,
  },
  {
    id: "house-103",
    title: "Luxury Studio Apartment Direct Sublease",
    propertyType: "studio",
    monthlyRent: 1100,
    bedrooms: 1,
    bathrooms: 1,
    distanceToCampus: "3 min walk",
    address: "105 University Towers",
    leaseTerm: "Full Year",
    listerName: "Chloe Zhang",
    listerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    listerRole: "Grad student",
    isVerifiedStudent: true,
    amenities: ["Fitness Center", "Doorman", "Central AC", "Study Lounge"],
    description: "Prime downtown studio with floor-to-ceiling windows, rooftop deck access, and indoor bike storage.",
    images: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&auto=format&fit=crop&q=80"],
    postedDate: "Yesterday",
    isAvailable: true,
  },
];

const INITIAL_INQUIRIES: HousingInquiry[] = [
  {
    id: "inq-201",
    housingId: "house-101",
    propertyTitle: "Modern 2BR Apartment Sublease Near Science Quad",
    applicantName: "Alex Mercer",
    applicantEmail: "alex.mercer@campus.edu",
    moveInDate: "June 1, 2026",
    message: "Hi Samantha! I am doing a summer research internship on campus and would love to sublease for June and July.",
    status: "pending",
    submittedDate: "Today, 11:00 AM",
  },
];

export class CampusHousingService {
  private static listings: HousingListing[] = [...INITIAL_HOUSING];
  private static inquiries: HousingInquiry[] = [...INITIAL_INQUIRIES];

  public static getListings(options?: Partial<HousingFilterOptions>): HousingListing[] {
    let result = [...this.listings];
    if (!options) return result;

    if (options.propertyType && options.propertyType !== "All") {
      result = result.filter((h) => h.propertyType === options.propertyType);
    }

    if (options.leaseTerm && options.leaseTerm !== "All") {
      result = result.filter((h) => h.leaseTerm === options.leaseTerm);
    }

    if (options.maxRent && options.maxRent > 0) {
      result = result.filter((h) => h.monthlyRent <= options.maxRent);
    }

    if (options.searchQuery && options.searchQuery.trim() !== "") {
      const q = options.searchQuery.toLowerCase().trim();
      result = result.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.address.toLowerCase().includes(q) ||
          h.description.toLowerCase().includes(q) ||
          h.amenities.some((a) => a.toLowerCase().includes(q))
      );
    }

    return result;
  }

  public static getListingById(id: string): HousingListing | undefined {
    return this.listings.find((h) => h.id === id);
  }

  public static createListing(
    listing: Omit<HousingListing, "id" | "postedDate" | "isAvailable">
  ): HousingListing {
    const newListing: HousingListing = {
      ...listing,
      id: `house-${Date.now()}`,
      postedDate: "Just now",
      isAvailable: true,
    };
    this.listings.unshift(newListing);
    return newListing;
  }

  public static getInquiries(): HousingInquiry[] {
    return [...this.inquiries];
  }

  public static submitInquiry(
    housingId: string,
    applicantName: string,
    applicantEmail: string,
    moveInDate: string,
    message: string
  ): HousingInquiry {
    const house = this.getListingById(housingId);
    if (!house) throw new Error("Housing listing not found.");

    const newInquiry: HousingInquiry = {
      id: `inq-${Date.now()}`,
      housingId,
      propertyTitle: house.title,
      applicantName,
      applicantEmail,
      moveInDate,
      message,
      status: "pending",
      submittedDate: "Just now",
    };

    this.inquiries.unshift(newInquiry);
    return newInquiry;
  }

  public static updateInquiryStatus(inquiryId: string, status: 'accepted' | 'declined'): boolean {
    const idx = this.inquiries.findIndex((i) => i.id === inquiryId);
    if (idx !== -1) {
      this.inquiries[idx].status = status;
      return true;
    }
    return false;
  }
}
