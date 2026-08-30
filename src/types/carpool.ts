export interface VehicleLocation {
  lat: number;
  lng: number;
  heading: number; // in degrees
  speedMph: number;
  lastUpdated: string;
}

export interface RidePassenger {
  id: string;
  name: string;
  avatarUrl?: string;
  pickupLocation: string;
  dropoffLocation: string;
  distanceMiles: number;
  calculatedCostShare: number;
  status: 'pending' | 'confirmed' | 'picked_up' | 'completed';
}

export interface CarpoolRide {
  id: string;
  driverId: string;
  driverName: string;
  driverRating: number;
  driverVerified: boolean;
  vehicleModel: string;
  licensePlate: string;
  totalSeats: number;
  availableSeats: number;
  origin: string;
  destination: string;
  departureTime: string;
  estimatedArrival: string;
  routeStops: { name: string; lat: number; lng: number; stopOrder: number }[];
  currentLocation?: VehicleLocation;
  passengers: RidePassenger[];
  status: 'scheduled' | 'en_route' | 'completed' | 'cancelled';
  safetySosTriggered: boolean;
}
