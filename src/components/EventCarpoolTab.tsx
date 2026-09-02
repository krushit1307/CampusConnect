// ============================================================
// CampusConnect – Event Carpool Tab Component
// src/components/EventCarpoolTab.tsx
// Issue #3663: Dynamic Carpool/Ride-Share Matchmaker
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  getEventCarpools,
  createCarpool,
  cancelCarpool,
  requestCarpoolSeat,
  acceptCarpoolRequest,
  declineCarpoolRequest,
  cancelCarpoolRequest,
  initiateDriverRiderDM,
  hasUserRequested,
  type Carpool,
  type CarpoolRequest,
} from "@/services/EventCarpoolService";

interface EventCarpoolTabProps {
  eventId: string;
  eventTitle: string;
  userId: string;
  className?: string;
}

export function EventCarpoolTab({
  eventId,
  eventTitle,
  userId,
  className,
}: EventCarpoolTabProps) {
  const [carpools, setCarpools] = useState<Carpool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [offerSeats, setOfferSeats] = useState(2);
  const [offerDeparture, setOfferDeparture] = useState("");
  const [offerLocation, setOfferLocation] = useState("");
  const [offerNotes, setOfferNotes] = useState("");
  const [pickupNotes, setPickupNotes] = useState<Record<string, string>>({});
  const [requestedSet, setRequestedSet] = useState<Set<string>>(new Set());

  const loadCarpools = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getEventCarpools(eventId);
      setCarpools(data);

      const requested = new Set<string>();
      for (const c of data) {
        const hasReq = await hasUserRequested(c.id, userId);
        if (hasReq) requested.add(c.id);
      }
      setRequestedSet(requested);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load carpools");
    } finally {
      setLoading(false);
    }
  }, [eventId, userId]);

  useEffect(() => {
    void loadCarpools();
  }, [loadCarpools]);

  const handleCreateCarpool = async () => {
    if (!offerDeparture || !offerLocation) return;
    try {
      setActionLoading(true);
      await createCarpool({
        event_id: eventId,
        driver_user_id: userId,
        seats_offered: offerSeats,
        departure_time: new Date(offerDeparture).toISOString(),
        location_string: offerLocation,
        notes: offerNotes || undefined,
      });
      setShowOfferForm(false);
      setOfferSeats(2);
      setOfferDeparture("");
      setOfferLocation("");
      setOfferNotes("");
      await loadCarpools();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create carpool");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestSeat = async (carpoolId: string) => {
    try {
      setActionLoading(true);
      await requestCarpoolSeat({
        carpool_id: carpoolId,
        rider_user_id: userId,
        pickup_notes: pickupNotes[carpoolId],
      });
      setRequestedSet((prev) => new Set(prev).add(carpoolId));
      setPickupNotes((prev) => ({ ...prev, [carpoolId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request seat");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptRequest = async (
    carpoolId: string,
    request: CarpoolRequest,
  ) => {
    try {
      setActionLoading(true);
      await acceptCarpoolRequest(request.id);
      await initiateDriverRiderDM(userId, request.rider_user_id, eventTitle);
      await loadCarpools();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept request");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineRequest = async (request: CarpoolRequest) => {
    try {
      setActionLoading(true);
      await declineCarpoolRequest(request.id);
      await loadCarpools();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decline request");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelCarpool = async (carpoolId: string) => {
    try {
      setActionLoading(true);
      await cancelCarpool(carpoolId);
      await loadCarpools();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel carpool");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      setActionLoading(true);
      await cancelCarpoolRequest(requestId);
      await loadCarpools();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel request");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="animate-pulse text-gray-500">Loading carpools…</div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">🚗 Ride Share</h3>
        {!showOfferForm && (
          <button
            onClick={() => setShowOfferForm(true)}
            disabled={actionLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            Offer a Ride
          </button>
        )}
      </div>

      {showOfferForm && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <h4 className="mb-4 font-medium text-gray-900">Offer a Ride</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Seats Available
              </label>
              <input
                type="number"
                min={1}
                max={8}
                value={offerSeats}
                onChange={(e) => setOfferSeats(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Departure Time
              </label>
              <input
                type="datetime-local"
                value={offerDeparture}
                onChange={(e) => setOfferDeparture(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Pickup Location
              </label>
              <input
                type="text"
                placeholder="e.g., North Campus Parking Lot"
                value={offerLocation}
                onChange={(e) => setOfferLocation(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Notes (optional)
              </label>
              <textarea
                placeholder="Any details about your car, luggage space, etc."
                value={offerNotes}
                onChange={(e) => setOfferNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreateCarpool}
              disabled={actionLoading || !offerDeparture || !offerLocation}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading ? "Creating…" : "Publish Offer"}
            </button>
            <button
              onClick={() => setShowOfferForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {carpools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500">
            No ride shares yet. Be the first to offer a ride!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {carpools.map((carpool) => {
            const isDriver = carpool.driver_user_id === userId;
            const seatsLeft = carpool.seats_offered - carpool.seats_taken;
            const hasRequested = requestedSet.has(carpool.id);
            const myRequest = carpool.requests?.find(
              (r) => r.rider_user_id === userId,
            );

            return (
              <div
                key={carpool.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {isDriver
                          ? "Your ride"
                          : `Driver: ${carpool.driver_name}`}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          carpool.status === "active" &&
                            "bg-green-100 text-green-700",
                          carpool.status === "full" &&
                            "bg-orange-100 text-orange-700",
                          carpool.status === "cancelled" &&
                            "bg-red-100 text-red-700",
                          carpool.status === "completed" &&
                            "bg-gray-100 text-gray-600",
                        )}
                      >
                        {carpool.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      📍 {carpool.location_string} · 🕐{" "}
                      {new Date(carpool.departure_time).toLocaleString(
                        "en-US",
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {carpool.seats_taken} / {carpool.seats_offered} seats
                      taken
                      {seatsLeft > 0 && (
                        <span className="ml-1 font-medium text-green-600">
                          ({seatsLeft} left)
                        </span>
                      )}
                    </p>
                    {carpool.notes && (
                      <p className="mt-2 text-sm italic text-gray-400">
                        "{carpool.notes}"
                      </p>
                    )}
                  </div>

                  {isDriver && carpool.status === "active" && (
                    <button
                      onClick={() => handleCancelCarpool(carpool.id)}
                      disabled={actionLoading}
                      className="text-sm text-red-600 hover:underline disabled:opacity-50"
                    >
                      Cancel Ride
                    </button>
                  )}
                </div>

                {!isDriver &&
                  carpool.status === "active" &&
                  seatsLeft > 0 &&
                  !hasRequested && (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <input
                        type="text"
                        placeholder="Pickup notes (optional)…"
                        value={pickupNotes[carpool.id] || ""}
                        onChange={(e) =>
                          setPickupNotes((prev) => ({
                            ...prev,
                            [carpool.id]: e.target.value,
                          }))
                        }
                        className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                      />
                      <button
                        onClick={() => handleRequestSeat(carpool.id)}
                        disabled={actionLoading}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                      >
                        {actionLoading ? "Requesting…" : "Request Seat"}
                      </button>
                    </div>
                  )}

                {myRequest && myRequest.status === "pending" && (
                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                    <span className="text-sm text-amber-600">
                      ⏳ Request pending — waiting for driver to respond
                    </span>
                    <button
                      onClick={() => handleCancelRequest(myRequest.id)}
                      disabled={actionLoading}
                      className="text-sm text-red-600 hover:underline disabled:opacity-50"
                    >
                      Cancel Request
                    </button>
                  </div>
                )}

                {myRequest && myRequest.status === "accepted" && (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <span className="text-sm text-green-600">
                      ✅ Your seat is confirmed! A DM thread has been opened
                      with the driver.
                    </span>
                  </div>
                )}

                {myRequest && myRequest.status === "declined" && (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <span className="text-sm text-red-500">
                      ❌ Your request was declined.
                    </span>
                  </div>
                )}

                {isDriver &&
                  carpool.requests &&
                  carpool.requests.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                      <p className="text-sm font-medium text-gray-700">
                        Seat Requests:
                      </p>
                      {carpool.requests
                        .filter((r) => r.status === "pending")
                        .map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                          >
                            <div>
                              <span className="text-sm font-medium">
                                {req.rider_name}
                              </span>
                              {req.pickup_notes && (
                                <span className="ml-2 text-xs text-gray-500">
                                  📍 {req.pickup_notes}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handleAcceptRequest(carpool.id, req)
                                }
                                disabled={actionLoading || seatsLeft <= 0}
                                className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleDeclineRequest(req)}
                                disabled={actionLoading}
                                className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      {carpool.requests.filter((r) => r.status === "pending")
                        .length === 0 && (
                        <p className="text-xs text-gray-400">
                          No pending requests.
                        </p>
                      )}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
