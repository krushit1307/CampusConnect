import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Car from "lucide-react/dist/esm/icons/car";
import Users from "lucide-react/dist/esm/icons/users";
import Check from "lucide-react/dist/esm/icons/check";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Clock from "lucide-react/dist/esm/icons/clock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CarpoolVehicle,
  CarpoolRequest,
  CarpoolMatch,
  createVehicle,
  createRequest,
  fetchMyVehicle,
  fetchMyRequest,
  getCarpoolMatches,
  fetchIncomingOffers,
  offerRide,
  acceptOffer,
  cancelVehicle,
  cancelRequest,
} from "@/lib/supabase/carpoolMatching";

interface CarpoolMatchingSectionProps {
  eventId: string;
  user: User | null;
}

export function CarpoolMatchingSection({ eventId, user }: CarpoolMatchingSectionProps) {
  const [loading, setLoading] = useState(true);

  const [myVehicle, setMyVehicle] = useState<CarpoolVehicle | null>(null);
  const [myRequest, setMyRequest] = useState<CarpoolRequest | null>(null);

  const [matches, setMatches] = useState<CarpoolMatch[]>([]);
  const [incomingOffers, setIncomingOffers] = useState<any[]>([]);

  // Registration states
  const [isRegisteringDriver, setIsRegisteringDriver] = useState(false);
  const [isRegisteringRider, setIsRegisteringRider] = useState(false);

  // Form states
  const [capacity, setCapacity] = useState(4);
  const [departureTime, setDepartureTime] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // Check if driver
    const { data: vehicleData } = await fetchMyVehicle(eventId, user.id);
    setMyVehicle(vehicleData);

    if (vehicleData) {
      const { data: matchesData } = await getCarpoolMatches(vehicleData.id);
      setMatches(matchesData ?? []);
    } else {
      // Check if rider
      const { data: requestData } = await fetchMyRequest(eventId, user.id);
      setMyRequest(requestData);

      if (requestData) {
        const { data: offersData } = await fetchIncomingOffers(requestData.id);
        setIncomingOffers(offersData ?? []);
      }
    }

    setLoading(false);
  }, [eventId, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRegisterDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await createVehicle({
      event_id: eventId,
      driver_user_id: user.id,
      available_seats: capacity,
      departure_time: new Date(departureTime).toISOString(),
      pickup_neighborhood: neighborhood.trim(),
      notes: notes.trim() || null,
    });

    if (error) {
      toast.error("Failed to register as driver.");
    } else {
      toast.success("Registered as driver!");
      setIsRegisteringDriver(false);
      await loadData();
    }
  };

  const handleRegisterRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await createRequest({
      event_id: eventId,
      rider_user_id: user.id,
      pickup_neighborhood: neighborhood.trim(),
      departure_time: new Date(departureTime).toISOString(),
    });

    if (error) {
      toast.error("Failed to register as rider.");
    } else {
      toast.success("Registered as rider!");
      setIsRegisteringRider(false);
      await loadData();
    }
  };

  const handleOfferRide = async (requestId: string) => {
    if (!myVehicle) return;
    const { data, error } = await offerRide(myVehicle.id, requestId);
    if (error || !data?.success) {
      toast.error(data?.message || "Failed to offer ride.");
    } else {
      toast.success("Ride offered! Rider will be notified.");
      await loadData();
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    const { data, error } = await acceptOffer(offerId);
    if (error || !data?.success) {
      toast.error(data?.message || "Failed to accept offer.");
    } else {
      toast.success("Ride accepted! A temporary group chat has been created.");
      await loadData();
    }
  };

  const handleCancelDriver = async () => {
    if (!myVehicle) return;
    if (!window.confirm("Cancel your carpool? All attached riders will be notified and dropped."))
      return;
    await cancelVehicle(myVehicle.id);
    await loadData();
  };

  const handleCancelRider = async () => {
    if (!myRequest) return;
    if (!window.confirm("Cancel your ride request?")) return;
    await cancelRequest(myRequest.id);
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex h-20 items-center justify-center border-2 border-black bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900">
        Carpool Matching
      </h2>

      {!user ? (
        <p className="text-sm font-mono text-slate-500">Sign in to coordinate carpools.</p>
      ) : myVehicle ? (
        // DRIVER DASHBOARD
        <div className="flex flex-col gap-4 border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold flex items-center gap-2 text-lg">
                <Car className="h-5 w-5" /> Your Vehicle
              </h3>
              <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {myVehicle.pickup_neighborhood}
              </p>
              <p className="text-sm text-slate-600 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {new Date(myVehicle.departure_time).toLocaleString()}
              </p>
              <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                <Users className="h-3 w-3" /> {myVehicle.available_seats} seats remaining
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCancelDriver} className="text-red-600">
              Cancel Trip
            </Button>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="font-semibold text-sm uppercase text-slate-500 mb-3">
              Suggested Riders
            </h4>
            {matches.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                No pending riders matching your route.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {matches.map((match) => (
                  <div
                    key={match.request_id}
                    className="flex justify-between items-center p-3 border border-slate-200 bg-slate-50 rounded"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {match.rider_profile?.full_name || "Anonymous"}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" /> {match.pickup_neighborhood}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />{" "}
                        {new Date(match.departure_time).toLocaleTimeString()}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => handleOfferRide(match.request_id)}>
                      Offer Ride
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : myRequest ? (
        // RIDER DASHBOARD
        <div className="flex flex-col gap-4 border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" /> Your Ride Request
              </h3>
              <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {myRequest.pickup_neighborhood}
              </p>
              <p className="text-sm text-slate-600 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {new Date(myRequest.departure_time).toLocaleString()}
              </p>

              <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                Status: {myRequest.status.toUpperCase()}
              </div>
            </div>
            {myRequest.status === "pending" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelRider}
                className="text-red-600"
              >
                Cancel Request
              </Button>
            )}
          </div>

          {myRequest.status === "matched" ? (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              You're matched! Check your messages for the group chat.
            </div>
          ) : (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <h4 className="font-semibold text-sm uppercase text-slate-500 mb-3">
                Incoming Offers
              </h4>
              {incomingOffers.length === 0 ? (
                <p className="text-sm text-slate-500 italic">
                  Waiting for drivers to offer a ride...
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {incomingOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 border border-amber-200 bg-amber-50 rounded gap-3"
                    >
                      <div>
                        <p className="font-medium text-sm text-amber-900">
                          {offer.vehicle.driver.full_name || "A Driver"}
                        </p>
                        <p className="text-xs text-amber-700 flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" /> {offer.vehicle.pickup_neighborhood}
                        </p>
                        <p className="text-xs text-amber-700 flex items-center gap-1">
                          <Clock className="h-3 w-3" />{" "}
                          {new Date(offer.vehicle.departure_time).toLocaleTimeString()}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => handleAcceptOffer(offer.id)}>
                        Accept Ride
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        // ONBOARDING
        <div className="flex flex-col gap-4">
          {!isRegisteringDriver && !isRegisteringRider && (
            <div className="flex gap-3">
              <Button onClick={() => setIsRegisteringDriver(true)} className="flex-1 gap-2">
                <Car className="h-4 w-4" /> I'm Driving
              </Button>
              <Button
                onClick={() => setIsRegisteringRider(true)}
                variant="secondary"
                className="flex-1 gap-2"
              >
                <Users className="h-4 w-4" /> I Need a Ride
              </Button>
            </div>
          )}

          {isRegisteringDriver && (
            <form
              onSubmit={handleRegisterDriver}
              className="flex flex-col gap-3 border-2 border-black bg-white p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <h3 className="font-bold">Register as Driver</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Seats available</Label>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Departure time</Label>
                  <Input
                    type="datetime-local"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Pickup Neighborhood</Label>
                <Input
                  placeholder="e.g. North Campus, Downtown"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Notes (optional)</Label>
                <Input
                  placeholder="e.g. No large suitcases, leaving promptly"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Submit</Button>
                <Button type="button" variant="ghost" onClick={() => setIsRegisteringDriver(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {isRegisteringRider && (
            <form
              onSubmit={handleRegisterRider}
              className="flex flex-col gap-3 border-2 border-black bg-white p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <h3 className="font-bold">Request a Ride</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Desired Departure time</Label>
                  <Input
                    type="datetime-local"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Your Neighborhood</Label>
                <Input
                  placeholder="e.g. North Campus, Downtown"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Submit</Button>
                <Button type="button" variant="ghost" onClick={() => setIsRegisteringRider(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
