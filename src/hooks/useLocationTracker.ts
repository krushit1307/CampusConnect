import { useState, useEffect } from "react";

export const useLocationTracker = (isTrackingEnabled: boolean) => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only track if the user has opted in for safety features
    if (!isTrackingEnabled) return;

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this device.");
      return;
    }

    // Continuously watch the user's live position
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        // TODO: In our next step, we will ping Supabase with these coordinates!
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true, // Critical for a precise 500ft geofence
        maximumAge: 0,
      },
    );

    // Cleanup the watcher when the component unmounts to save battery
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTrackingEnabled]);

  return { location, error };
};
