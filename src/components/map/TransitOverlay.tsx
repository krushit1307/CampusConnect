import React from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTransitStream } from '../../hooks/useTransitStream';

// Define custom icons for the buses
const busIcon = new L.Icon({
  iconUrl: '/bus-marker.png', // Assuming a static asset
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

export const TransitOverlay: React.FC = () => {
  // Connect to our new WebSocket backend
  // In production, the URL would be dynamic based on the environment (wss://...)
  const wsUrl = 'ws://localhost:5174/api/transit-stream';
  const { buses, isConnected } = useTransitStream(wsUrl);

  const map = useMap();

  // Optionally, you can add a small UI indicator if disconnected
  if (!isConnected) {
    console.warn("Transit stream disconnected. Trying to reconnect...");
  }

  return (
    <>
      {buses.map((bus) => (
        // The Leaflet Marker component handles smooth interpolation 
        // natively if the coordinate updates are frequent enough (1s),
        // preventing the harsh teleports caused by 5s HTTP polling.
        <Marker 
          key={bus.busId} 
          position={[bus.lat, bus.lng]} 
          icon={busIcon}
          // Note: In advanced Leaflet setups, you can use rotation plugins
          // to angle the icon based on `bus.heading`
        >
          <Popup>
            <div className="font-sans">
              <h3 className="font-bold text-lg">{bus.routeId}</h3>
              <p className="text-sm text-gray-600">Bus ID: {bus.busId}</p>
              <p className="text-sm font-medium mt-1">Speed: {Math.round(bus.speed)} mph</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};
