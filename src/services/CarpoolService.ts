// ============================================================
// CampusConnect – Carpool Service Layer
// src/services/CarpoolService.ts
// ============================================================

export type RideStatus = "open" | "full" | "completed" | "cancelled" | "in-progress";
export type RideCategory =
  "Holiday Break" | "Groceries" | "Airport" | "Commute" | "Event" | "Other";

export interface CarpoolRide {
  id: string;
  driverId: string;
  driverName: string;
  driverAvatar: string;
  driverRating: number;
  totalTrips: number;
  departure: LocationPoint;
  destination: LocationPoint;
  departureTime: string; // ISO
  estimatedDurationMins: number;
  carModel: string;
  category: RideCategory;
  totalSeats: number;
  bookedSeats: number;
  pricePerSeat: number;
  status: RideStatus;
  notes: string;
  allowedLuggage: "Small" | "Medium" | "Large" | "None";
  musicPreference: string;
  verifiedDriver: boolean;
  passengers: Passenger[];
}

export interface LocationPoint {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface Passenger {
  userId: string;
  name: string;
  avatarUrl: string;
  status: "confirmed" | "pending";
}

export interface CarpoolFilters {
  query: string;
  category: RideCategory | "All";
  maxPrice: number;
  minRating: number;
  verifiedOnly: boolean;
  hideFull: boolean;
  dateStart: string | null;
  dateEnd: string | null;
  sortBy: "date_asc" | "date_desc" | "price_asc" | "rating";
}

export interface RideStats {
  activeRides: number;
  seatsAvailable: number;
  averagePrice: number;
  co2SavedKg: number;
}

// ── Mock Data ───────────────────────────────────────────────

const AVATAR_SEEDS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Sam",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Riley",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Taylor",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan",
];

const MOCK_RIDES: CarpoolRide[] = [
  {
    id: "ride-001",
    driverId: "user-101",
    driverName: "Sam Winchester",
    driverAvatar: AVATAR_SEEDS[0],
    driverRating: 4.9,
    totalTrips: 34,
    departure: { name: "North Campus Dorms", address: "123 North St", lat: 0, lng: 0 },
    destination: { name: "International Airport (JFK)", address: "Terminal 4", lat: 0, lng: 0 },
    departureTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedDurationMins: 45,
    carModel: "2018 Honda Civic",
    category: "Airport",
    totalSeats: 3,
    bookedSeats: 1,
    pricePerSeat: 15,
    status: "open",
    notes:
      "Heading to the airport for Thanksgiving break. I have a decent sized trunk, but let me know if you have huge bags.",
    allowedLuggage: "Medium",
    musicPreference: "Indie Rock / Podcasts",
    verifiedDriver: true,
    passengers: [
      { userId: "user-202", name: "Alice", avatarUrl: AVATAR_SEEDS[2], status: "confirmed" },
    ],
  },
  {
    id: "ride-002",
    driverId: "user-102",
    driverName: "Riley Miller",
    driverAvatar: AVATAR_SEEDS[1],
    driverRating: 4.7,
    totalTrips: 12,
    departure: { name: "Student Union", address: "Main Quad", lat: 0, lng: 0 },
    destination: { name: "Trader Joe's", address: "400 W Market", lat: 0, lng: 0 },
    departureTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
    estimatedDurationMins: 15,
    carModel: "2015 Toyota Prius",
    category: "Groceries",
    totalSeats: 4,
    bookedSeats: 4,
    pricePerSeat: 3,
    status: "full",
    notes: "Weekly grocery run! We'll spend about an hour at the store before heading back.",
    allowedLuggage: "Small",
    musicPreference: "Pop / Top 40",
    verifiedDriver: true,
    passengers: [
      { userId: "user-203", name: "Bob", avatarUrl: AVATAR_SEEDS[3], status: "confirmed" },
      { userId: "user-204", name: "Charlie", avatarUrl: AVATAR_SEEDS[0], status: "confirmed" },
      { userId: "user-205", name: "Diana", avatarUrl: AVATAR_SEEDS[2], status: "confirmed" },
      { userId: "user-206", name: "Eve", avatarUrl: AVATAR_SEEDS[1], status: "confirmed" },
    ],
  },
  {
    id: "ride-003",
    driverId: "user-103",
    driverName: "Taylor Swift",
    driverAvatar: AVATAR_SEEDS[2],
    driverRating: 5.0,
    totalTrips: 89,
    departure: { name: "West Village Apartments", address: "Ap 4B", lat: 0, lng: 0 },
    destination: { name: "Chicago, IL", address: "Downtown Loop", lat: 0, lng: 0 },
    departureTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedDurationMins: 360, // 6 hours
    carModel: "2021 Tesla Model 3",
    category: "Holiday Break",
    totalSeats: 3,
    bookedSeats: 0,
    pricePerSeat: 40,
    status: "open",
    notes:
      "Driving home for winter break. Supercharging stops included. No smoking in the car please.",
    allowedLuggage: "Large",
    musicPreference: "Pop / Taylor Swift",
    verifiedDriver: true,
    passengers: [],
  },
  {
    id: "ride-004",
    driverId: "user-104",
    driverName: "Jordan Kim",
    driverAvatar: AVATAR_SEEDS[3],
    driverRating: 4.5,
    totalTrips: 5,
    departure: { name: "Engineering Library", address: "East Campus", lat: 0, lng: 0 },
    destination: { name: "Tech Conference Center", address: "Downtown", lat: 0, lng: 0 },
    departureTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedDurationMins: 30,
    carModel: "2010 Ford Focus",
    category: "Event",
    totalSeats: 2,
    bookedSeats: 1,
    pricePerSeat: 5,
    status: "open",
    notes: "Heading to the hackathon kickoff event. Can fit one more.",
    allowedLuggage: "Small",
    musicPreference: "Lo-Fi Beats",
    verifiedDriver: false,
    passengers: [
      { userId: "user-207", name: "Frank", avatarUrl: AVATAR_SEEDS[1], status: "pending" },
    ],
  },
];

// ── Service Functions ────────────────────────────────────────

export function getDefaultFilters(): CarpoolFilters {
  return {
    query: "",
    category: "All",
    maxPrice: 60,
    minRating: 0,
    verifiedOnly: false,
    hideFull: true,
    dateStart: null,
    dateEnd: null,
    sortBy: "date_asc",
  };
}

export function fetchRides(filters: CarpoolFilters): CarpoolRide[] {
  let results = [...MOCK_RIDES];

  if (filters.query.trim()) {
    const q = filters.query.toLowerCase();
    results = results.filter(
      (r) =>
        r.destination.name.toLowerCase().includes(q) ||
        r.departure.name.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q),
    );
  }

  if (filters.category !== "All") {
    results = results.filter((r) => r.category === filters.category);
  }

  results = results.filter((r) => r.pricePerSeat <= filters.maxPrice);
  results = results.filter((r) => r.driverRating >= filters.minRating);

  if (filters.verifiedOnly) {
    results = results.filter((r) => r.verifiedDriver);
  }

  if (filters.hideFull) {
    results = results.filter((r) => r.status === "open");
  }

  if (filters.dateStart) {
    const start = new Date(filters.dateStart).getTime();
    results = results.filter((r) => new Date(r.departureTime).getTime() >= start);
  }

  if (filters.dateEnd) {
    // Add 1 day to include the end date fully
    const end = new Date(filters.dateEnd).getTime() + 86400000;
    results = results.filter((r) => new Date(r.departureTime).getTime() <= end);
  }

  switch (filters.sortBy) {
    case "date_asc":
      results.sort(
        (a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime(),
      );
      break;
    case "date_desc":
      results.sort(
        (a, b) => new Date(b.departureTime).getTime() - new Date(a.departureTime).getTime(),
      );
      break;
    case "price_asc":
      results.sort((a, b) => a.pricePerSeat - b.pricePerSeat);
      break;
    case "rating":
      results.sort((a, b) => b.driverRating - a.driverRating);
      break;
  }

  return results;
}

export function fetchRideStats(): RideStats {
  const openRides = MOCK_RIDES.filter((r) => r.status === "open");

  return {
    activeRides: openRides.length,
    seatsAvailable: openRides.reduce((acc, r) => acc + (r.totalSeats - r.bookedSeats), 0),
    averagePrice:
      openRides.length > 0
        ? Math.round(openRides.reduce((acc, r) => acc + r.pricePerSeat, 0) / openRides.length)
        : 0,
    co2SavedKg: 12450, // arbitrary stat
  };
}

export function bookRide(rideId: string): Promise<{ success: boolean; message: string }> {
  const ride = MOCK_RIDES.find((r) => r.id === rideId);
  if (!ride) return Promise.reject(new Error("Ride not found"));
  if (ride.status === "full" || ride.bookedSeats >= ride.totalSeats) {
    return Promise.reject(new Error("Ride is already full"));
  }

  // Simulate network
  return new Promise((resolve) => {
    setTimeout(() => {
      ride.bookedSeats += 1;
      ride.passengers.push({
        userId: "student-me",
        name: "You",
        avatarUrl: AVATAR_SEEDS[1],
        status: "pending",
      });
      if (ride.bookedSeats >= ride.totalSeats) {
        ride.status = "full";
      }
      resolve({
        success: true,
        message: `Successfully requested to join ride to ${ride.destination.name}`,
      });
    }, 800);
  });
}

export function getCategories(): RideCategory[] {
  return ["Airport", "Groceries", "Holiday Break", "Commute", "Event", "Other"];
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
