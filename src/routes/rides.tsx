import React, { useState } from 'react';
import { SiteShell } from '@/components/site/SiteShell';
import { LiveFleetMap } from '@/components/carpool/LiveFleetMap';
import { RideRequestModal } from '@/components/carpool/RideRequestModal';
import { CarpoolRide } from '@/types/carpool';
import {
  Car,
  ShieldCheck,
  Search,
  Plus,
  Clock,
  MapPin,
  Users,
  Radio,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

export default function CampusRidesPage() {
  const [selectedRide, setSelectedRide] = useState<CarpoolRide | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [searchOrigin, setSearchOrigin] = useState('');

  const [rides, setRides] = useState<CarpoolRide[]>([
    {
      id: 'ride-1',
      driverId: 'drv-1',
      driverName: 'Ethan Carter',
      driverRating: 4.9,
      driverVerified: true,
      vehicleModel: 'Honda Civic Hybrid (Blue)',
      licensePlate: '7ABC123',
      totalSeats: 4,
      availableSeats: 2,
      origin: 'North Campus Quad',
      destination: 'Central Transit Center / Train Station',
      departureTime: '17:30',
      estimatedArrival: '17:55',
      routeStops: [
        { name: 'North Campus Quad', lat: 40.71, lng: -74.01, stopOrder: 1 },
        { name: 'Engineering Library', lat: 40.72, lng: -74.02, stopOrder: 2 },
        { name: 'Student Union Hub', lat: 40.73, lng: -74.03, stopOrder: 3 },
        { name: 'Graduate Housing', lat: 40.74, lng: -74.04, stopOrder: 4 },
        { name: 'Train Station', lat: 40.75, lng: -74.05, stopOrder: 5 },
      ],
      passengers: [
        { id: 'p1', name: 'Maya Lin', pickupLocation: 'North Campus Quad', dropoffLocation: 'Train Station', distanceMiles: 4.2, calculatedCostShare: 3.5, status: 'confirmed' },
        { id: 'p2', name: 'Leo Vance', pickupLocation: 'Engineering Library', dropoffLocation: 'Train Station', distanceMiles: 3.1, calculatedCostShare: 2.8, status: 'confirmed' },
      ],
      status: 'en_route',
      safetySosTriggered: false,
    },
    {
      id: 'ride-2',
      driverId: 'drv-2',
      driverName: 'Chloe Bennett',
      driverRating: 5.0,
      driverVerified: true,
      vehicleModel: 'Toyota RAV4 (Silver)',
      licensePlate: '9XYZ456',
      totalSeats: 4,
      availableSeats: 3,
      origin: 'Main Research Library',
      destination: 'West Campus Apartment Village',
      departureTime: '19:00',
      estimatedArrival: '19:20',
      routeStops: [
        { name: 'Main Research Library', lat: 40.72, lng: -74.02, stopOrder: 1 },
        { name: 'Recreation Center', lat: 40.73, lng: -74.03, stopOrder: 2 },
        { name: 'West Campus Village', lat: 40.75, lng: -74.05, stopOrder: 3 },
      ],
      passengers: [
        { id: 'p3', name: 'Samira K.', pickupLocation: 'Main Research Library', dropoffLocation: 'West Campus Village', distanceMiles: 2.5, calculatedCostShare: 2.2, status: 'confirmed' },
      ],
      status: 'scheduled',
      safetySosTriggered: false,
    },
  ]);

  const activeTrackingRide = selectedRide || rides[0];

  const handleRequestSeat = (rideId: string, pickup: string, dropoff: string) => {
    setRides((prev) =>
      prev.map((r) =>
        r.id === rideId
          ? {
              ...r,
              availableSeats: Math.max(0, r.availableSeats - 1),
              passengers: [
                ...r.passengers,
                {
                  id: `pass-${Date.now()}`,
                  name: 'You (Alex)',
                  pickupLocation: pickup,
                  dropoffLocation: dropoff,
                  distanceMiles: 3.0,
                  calculatedCostShare: 3.0,
                  status: 'confirmed',
                },
              ],
            }
          : r
      )
    );
  };

  const handleTriggerSos = (rideId: string) => {
    setRides((prev) =>
      prev.map((r) =>
        r.id === rideId ? { ...r, safetySosTriggered: !r.safetySosTriggered } : r
      )
    );
  };

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-6 border-b-4 border-black pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-lime border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Car size={24} />
                </span>
                <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight text-black">
                  Campus Fleet & Student Carpools
                </h1>
              </div>
              <p className="font-mono text-sm text-gray-600 mt-1">
                Verified student rides, live GPS telemetry tracking & proportional gas cost-splitting.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-white px-3.5 py-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono text-xs font-bold text-gray-700">
              <ShieldCheck size={18} className="text-emerald-600" />
              <span>Campus Safety Geofence Active</span>
            </div>
          </div>

          {/* Main Layout Grid: Live Telemetry Map on Left, Active Rides List on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <LiveFleetMap
                ride={activeTrackingRide}
                onTriggerSos={handleTriggerSos}
              />
            </div>

            <div className="lg:col-span-1 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-black text-xl text-black">
                  Available Scheduled Rides
                </h3>
                <span className="font-mono text-xs text-gray-500 font-bold">
                  {rides.length} active routes
                </span>
              </div>

              <div className="space-y-4">
                {rides.map((ride) => (
                  <div
                    key={ride.id}
                    onClick={() => setSelectedRide(ride)}
                    className={`bg-white border-2 border-black rounded-lg p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer transition-all ${
                      activeTrackingRide.id === ride.id ? 'ring-4 ring-lime scale-[1.02]' : 'hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="font-display font-black text-base text-black">
                          {ride.origin} → {ride.destination}
                        </div>
                        <div className="font-mono text-xs text-gray-500">
                          {ride.driverName} ({ride.vehicleModel})
                        </div>
                      </div>

                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                          ride.status === 'en_route'
                            ? 'bg-green-100 text-green-800 border-green-300 animate-pulse'
                            : 'bg-slate-100 text-gray-700 border-slate-300'
                        }`}
                      >
                        {ride.status === 'en_route' ? 'Live on Route' : 'Scheduled'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono my-3 bg-slate-50 p-2.5 rounded border border-slate-200">
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase">Departure</span>
                        <div className="font-bold">{ride.departureTime}</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase">Seats Remaining</span>
                        <div className="font-bold text-emerald-700">{ride.availableSeats} of {ride.totalSeats}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-xs text-gray-500 font-bold">
                        Avg Fare: ~$3.00/person
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRide(ride);
                          setIsRequestModalOpen(true);
                        }}
                        disabled={ride.availableSeats === 0}
                        className="neu-border bg-lime hover:bg-lime/90 px-3 py-1.5 font-mono text-xs font-black uppercase text-black disabled:opacity-40"
                      >
                        Request Seat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ride Request Modal */}
      {selectedRide && (
        <RideRequestModal
          ride={selectedRide}
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          onRequestSeat={handleRequestSeat}
        />
      )}
    </SiteShell>
  );
}
