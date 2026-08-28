// ============================================================
// CampusConnect – Housing Service Layer
// src/services/HousingService.ts
// ============================================================

export type ListingType = "sublease" | "roommate";
export type LeaseTerm = "Summer" | "Fall" | "Spring" | "Full Year";
export type RoomType = "Private Room" | "Shared Room" | "Studio" | "Entire Apartment";

export interface HousingLocation {
    address: string;
    name: string;
    distanceToCampusMiles: number;
}

export interface RoommatePreferences {
    cleanliness: 1 | 2 | 3 | 4 | 5; // 1 = Messy, 5 = Neat Freak
    noiseLevel: 1 | 2 | 3 | 4 | 5; // 1 = Quiet, 5 = Loud/Parties
    sleepSchedule: "Early Bird" | "Night Owl" | "Mixed";
    petsAllowed: boolean;
    smokingAllowed: boolean;
    guestsAllowed: "Strict" | "Moderate" | "Relaxed";
}

export interface HousingListing {
    id: string;
    authorId: string;
    authorName: string;
    authorAvatar: string;
    authorDept: string;
    authorYear: string;
    type: ListingType;
    title: string;
    description: string;
    pricePerMonth: number;
    utilitiesIncluded: boolean;
    moveInDate: string; // ISO
    leaseTerm: LeaseTerm;
    roomType: RoomType;
    location: HousingLocation;
    images: string[];
    amenities: string[];
    preferences: RoommatePreferences;
    status: "available" | "pending" | "closed";
    createdAt: string; // ISO
}

export interface HousingFilters {
    query: string;
    type: ListingType | "all";
    maxPrice: number;
    maxDistance: number;
    term: LeaseTerm | "all";
    roomType: RoomType | "all";
    petsOnly: boolean;
    utilitiesOnly: boolean;
}

// ── Mock Data ───────────────────────────────────────────────

const AMENITIES = ["In-unit Washer/Dryer", "Gym", "Pool", "Dishwasher", "Balcony", "Furnished", "Parking", "AC", "Heating"];

const MOCK_LISTINGS: HousingListing[] = [
    {
        id: "hse-001",
        authorId: "user-101",
        authorName: "Jessica Chen",
        authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica",
        authorDept: "Computer Science",
        authorYear: "Junior",
        type: "sublease",
        title: "Beautiful Sunny Room in 4x4 near North Campus",
        description: "I'm looking to sublease my room for the summer. It's fully furnished with a desk, bed, and huge window. My roommates are 3 other quiet CS girls. Right next to the bus stop!",
        pricePerMonth: 650,
        utilitiesIncluded: false,
        moveInDate: "2026-05-15T00:00:00Z",
        leaseTerm: "Summer",
        roomType: "Private Room",
        location: { name: "The Standard", address: "123 College Ave", distanceToCampusMiles: 0.5 },
        images: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80"],
        amenities: ["In-unit Washer/Dryer", "Furnished", "Gym", "Pool"],
        preferences: {
            cleanliness: 4,
            noiseLevel: 2,
            sleepSchedule: "Early Bird",
            petsAllowed: false,
            smokingAllowed: false,
            guestsAllowed: "Strict"
        },
        status: "available",
        createdAt: "2026-04-01T10:00:00Z"
    },
    {
        id: "hse-002",
        authorId: "user-102",
        authorName: "Marcus Johnson",
        authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus",
        authorDept: "Business",
        authorYear: "Senior",
        type: "roommate",
        title: "Looking for 1 chill roommate for downtown apartment",
        description: "Found an awesome 2b2b downtown. I need one person to sign the lease with me. I'm pretty laid back, usually studying or at the gym. Prefer someone clean in common areas.",
        pricePerMonth: 900,
        utilitiesIncluded: true,
        moveInDate: "2026-08-01T00:00:00Z",
        leaseTerm: "Full Year",
        roomType: "Private Room",
        location: { name: "Skyline Lofts", address: "400 Main St", distanceToCampusMiles: 2.1 },
        images: ["https://images.unsplash.com/photo-1502672260266-1c1f5523a5d1?w=800&q=80"],
        amenities: ["In-unit Washer/Dryer", "Balcony", "Parking", "Gym"],
        preferences: {
            cleanliness: 3,
            noiseLevel: 3,
            sleepSchedule: "Mixed",
            petsAllowed: true,
            smokingAllowed: false,
            guestsAllowed: "Moderate"
        },
        status: "available",
        createdAt: "2026-04-05T14:30:00Z"
    },
    {
        id: "hse-003",
        authorId: "user-103",
        authorName: "Sarah Smith",
        authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
        authorDept: "Art History",
        authorYear: "Sophomore",
        type: "sublease",
        title: "Cozy Studio near Art Building",
        description: "Taking a semester abroad, subleasing my quiet studio. Very close to the arts quad. Cats allowed!",
        pricePerMonth: 1200,
        utilitiesIncluded: true,
        moveInDate: "2026-08-15T00:00:00Z",
        leaseTerm: "Fall",
        roomType: "Studio",
        location: { name: "Heritage Apartments", address: "50 Arts Way", distanceToCampusMiles: 0.1 },
        images: ["https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&q=80"],
        amenities: ["AC", "Heating", "Parking"],
        preferences: {
            cleanliness: 5,
            noiseLevel: 1,
            sleepSchedule: "Early Bird",
            petsAllowed: true,
            smokingAllowed: false,
            guestsAllowed: "Moderate"
        },
        status: "available",
        createdAt: "2026-04-10T09:15:00Z"
    },
    {
        id: "hse-004",
        authorId: "user-104",
        authorName: "David Lee",
        authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
        authorDept: "Engineering",
        authorYear: "Grad Student",
        type: "roommate",
        title: "Grad Student seeking roommate for quiet house",
        description: "Looking for a mature, quiet roommate (preferably another grad student) to share a 3b house. Large backyard, very quiet neighborhood.",
        pricePerMonth: 550,
        utilitiesIncluded: false,
        moveInDate: "2026-08-01T00:00:00Z",
        leaseTerm: "Full Year",
        roomType: "Private Room",
        location: { name: "Oakwood House", address: "800 Oak St", distanceToCampusMiles: 3.5 },
        images: ["https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&q=80"],
        amenities: ["In-unit Washer/Dryer", "Dishwasher", "Parking", "Balcony"],
        preferences: {
            cleanliness: 5,
            noiseLevel: 1,
            sleepSchedule: "Mixed",
            petsAllowed: false,
            smokingAllowed: false,
            guestsAllowed: "Strict"
        },
        status: "pending",
        createdAt: "2026-04-12T16:45:00Z"
    }
];

export function getDefaultFilters(): HousingFilters {
    return {
        query: "",
        type: "all",
        maxPrice: 2000,
        maxDistance: 5,
        term: "all",
        roomType: "all",
        petsOnly: false,
        utilitiesOnly: false
    };
}

export function fetchListings(filters: HousingFilters): HousingListing[] {
    let results = [...MOCK_LISTINGS];

    if (filters.query.trim()) {
        const q = filters.query.toLowerCase();
        results = results.filter(
            r => r.title.toLowerCase().includes(q) ||
                r.description.toLowerCase().includes(q) ||
                r.location.name.toLowerCase().includes(q)
        );
    }

    if (filters.type !== "all") results = results.filter(r => r.type === filters.type);
    if (filters.term !== "all") results = results.filter(r => r.leaseTerm === filters.term);
    if (filters.roomType !== "all") results = results.filter(r => r.roomType === filters.roomType);
    if (filters.petsOnly) results = results.filter(r => r.preferences.petsAllowed);
    if (filters.utilitiesOnly) results = results.filter(r => r.utilitiesIncluded);

    results = results.filter(r => r.pricePerMonth <= filters.maxPrice);
    results = results.filter(r => r.location.distanceToCampusMiles <= filters.maxDistance);

    // default sort by newest
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return results;
}

export function requestTour(listingId: string, message: string): Promise<{ success: boolean; message: string }> {
    const listing = MOCK_LISTINGS.find(l => l.id === listingId);
    if (!listing) return Promise.reject(new Error("Listing not found"));

    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ success: true, message: `Message sent to ${listing.authorName}! They will reply via Campus Connect Chat.` });
        }, 1000);
    });
}
