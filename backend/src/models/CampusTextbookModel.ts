export interface TextbookListing {
  id: string;
  title: string;
  isbn: string;
  author: string;
  edition: string;
  courseCode: string;
  condition: 'like-new' | 'good' | 'fair' | 'annotated';
  price: number;
  sellerName: string;
  sellerAvatar: string;
  sellerRating: number;
  department: string;
  status: 'available' | 'reserved' | 'sold';
  postedDate: string;
  description: string;
  includesNotes: boolean;
}

export interface TextbookOffer {
  id: string;
  textbookId: string;
  bookTitle: string;
  buyerName: string;
  offeredPrice: number;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  createdDate: string;
}

export interface TextbookFilterOptions {
  department: string;
  condition: string;
  maxPrice: number;
  includesNotesOnly: boolean;
  searchQuery: string;
}

const INITIAL_TEXTBOOKS: TextbookListing[] = [
  {
    id: "tb-101",
    title: "Introduction to Algorithms (4th Edition)",
    isbn: "978-0262046305",
    author: "Thomas H. Cormen, Charles E. Leiserson",
    edition: "4th Edition",
    courseCode: "CS 301",
    condition: "like-new",
    price: 45,
    sellerName: "Sarah Jenkins",
    sellerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    sellerRating: 4.9,
    department: "Computer Science",
    status: "available",
    postedDate: "2 days ago",
    description: "Hardcover condition with no highlighted text. Essential for CS 301 and CS 401 algorithms courses.",
    includesNotes: true,
  },
  {
    id: "tb-102",
    title: "Organic Chemistry with Biological Applications",
    isbn: "978-1285845258",
    author: "John E. McMurry",
    edition: "3rd Edition",
    courseCode: "CHEM 210",
    condition: "good",
    price: 35,
    sellerName: "Daniel Wu",
    sellerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    sellerRating: 4.8,
    department: "Chemistry",
    status: "available",
    postedDate: "Yesterday",
    description: "Light highlighting in chapters 4-6. Includes full solutions manual PDF upon purchase.",
    includesNotes: true,
  },
  {
    id: "tb-103",
    title: "Calculus: Early Transcendentals",
    isbn: "978-1337613927",
    author: "James Stewart, Daniel K. Clegg",
    edition: "9th Edition",
    courseCode: "MATH 241",
    condition: "fair",
    price: 25,
    sellerName: "Emily Rivera",
    sellerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    sellerRating: 5.0,
    department: "Mathematics",
    status: "available",
    postedDate: "3 days ago",
    description: "Well-used copy with handwritten notes on practice problems. Great budget option for Calc III.",
    includesNotes: false,
  },
  {
    id: "tb-104",
    title: "Sears and Zemansky's University Physics",
    isbn: "978-0135159552",
    author: "Hugh D. Young, Roger A. Freedman",
    edition: "15th Edition",
    courseCode: "PHYS 180",
    condition: "like-new",
    price: 40,
    sellerName: "Michael Chang",
    sellerAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    sellerRating: 4.7,
    department: "Physics",
    status: "available",
    postedDate: "Just now",
    description: "Pristine condition hardcover with unused MasteringPhysics access code card included.",
    includesNotes: false,
  },
];

const INITIAL_OFFERS: TextbookOffer[] = [
  {
    id: "off-201",
    textbookId: "tb-101",
    bookTitle: "Introduction to Algorithms (4th Edition)",
    buyerName: "Alex Mercer",
    offeredPrice: 40,
    message: "Hi Sarah! Can pick it up tomorrow at the Library computer lab.",
    status: "pending",
    createdDate: "Today, 10:15 AM",
  },
];

export class CampusTextbookService {
  private static listings: TextbookListing[] = [...INITIAL_TEXTBOOKS];
  private static offers: TextbookOffer[] = [...INITIAL_OFFERS];

  public static getListings(options?: Partial<TextbookFilterOptions>): TextbookListing[] {
    let result = [...this.listings];
    if (!options) return result;

    if (options.department && options.department !== "All") {
      result = result.filter((b) => b.department === options.department);
    }

    if (options.condition && options.condition !== "All") {
      result = result.filter((b) => b.condition === options.condition);
    }

    if (options.maxPrice && options.maxPrice > 0) {
      result = result.filter((b) => b.price <= options.maxPrice);
    }

    if (options.includesNotesOnly) {
      result = result.filter((b) => b.includesNotes);
    }

    if (options.searchQuery && options.searchQuery.trim() !== "") {
      const q = options.searchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.isbn.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.courseCode.toLowerCase().includes(q)
      );
    }

    return result;
  }

  public static getListingById(id: string): TextbookListing | undefined {
    return this.listings.find((b) => b.id === id);
  }

  public static createListing(
    listing: Omit<TextbookListing, "id" | "sellerRating" | "status" | "postedDate">
  ): TextbookListing {
    const newListing: TextbookListing = {
      ...listing,
      id: `tb-${Date.now()}`,
      sellerRating: 5.0,
      status: "available",
      postedDate: "Just now",
    };
    this.listings.unshift(newListing);
    return newListing;
  }

  public static getOffers(): TextbookOffer[] {
    return [...this.offers];
  }

  public static makeOffer(
    textbookId: string,
    buyerName: string,
    offeredPrice: number,
    message: string
  ): TextbookOffer {
    const book = this.getListingById(textbookId);
    if (!book) throw new Error("Textbook listing not found.");

    const newOffer: TextbookOffer = {
      id: `off-${Date.now()}`,
      textbookId,
      bookTitle: book.title,
      buyerName,
      offeredPrice,
      message,
      status: "pending",
      createdDate: "Just now",
    };

    this.offers.unshift(newOffer);
    return newOffer;
  }

  public static updateOfferStatus(offerId: string, status: 'accepted' | 'declined'): boolean {
    const idx = this.offers.findIndex((o) => o.id === offerId);
    if (idx !== -1) {
      this.offers[idx].status = status;
      if (status === 'accepted') {
        const book = this.getListingById(this.offers[idx].textbookId);
        if (book) book.status = 'reserved';
      }
      return true;
    }
    return false;
  }
}
