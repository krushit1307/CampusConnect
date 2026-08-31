// client/components/AutonomousRideTracker.jsx
import React, { useState, useEffect } from 'react';

export const AutonomousRideTracker = ({ socket, rideId, initialRideData }) => {
  const [rideState, setRideState] = useState(initialRideData);
  const [vehicleGps, setVehicleGps] = useState(initialRideData.vehicleLocation);
  const [unlockStatus, setUnlockStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!socket || !rideId) return;

    socket.emit('join:ride_room', { rideId });

    socket.on('av:telemetry_update', (telemetry) => {
      setVehicleGps(telemetry.currentLocation);
      setRideState((prev) => ({
        ...prev,
        status: telemetry.status
      }));
    });

    return () => {
      socket.off('av:telemetry_update');
    };
  }, [socket, rideId]);

  const handleUnlockDoors = async () => {
    setIsLoading(true);
    setUnlockStatus(null);
    try {
      const res = await fetch(`/api/carpool/${rideId}/unlock-doors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setUnlockStatus({ success: true, message: data.message });
      } else {
        setUnlockStatus({ success: false, message: data.error });
      }
    } catch (err) {
      setUnlockStatus({ success: false, message: 'Network error communicating with vehicle.' });
    } finally {
      setIsLoading(false);
    }
  };

  const isArrived = rideState.status === 'ARRIVED';

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1.5rem', maxWidth: '420px', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.8rem', background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
            AUTONOMOUS SHUTTLE
          </span>
          <h3 style={{ margin: '0.5rem 0 0 0' }}>{rideState.driver.name}</h3>
        </div>
        <div style={{ fontSize: '1.8rem' }}>🤖</div>
      </div>

      <div style={{ background: '#f8f9fa', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          <strong>Status:</strong> <span style={{ color: isArrived ? '#2e7d32' : '#0275d8' }}>{rideState.status}</span>
        </p>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>
          GPS: Lat {vehicleGps?.lat?.toFixed(4)}, Lng {vehicleGps?.lng?.toFixed(4)}
        </p>
      </div>

      {unlockStatus && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '6px',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          backgroundColor: unlockStatus.success ? '#e8f5e9' : '#ffebee',
          color: unlockStatus.success ? '#2e7d32' : '#c62828'
        }}>
          {unlockStatus.message}
        </div>
      )}

      <button
        onClick={handleUnlockDoors}
        disabled={!isArrived || isLoading}
        style={{
          width: '100%',
          padding: '0.85rem',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: isArrived ? '#2e7d32' : '#cccccc',
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: '1rem',
          cursor: isArrived && !isLoading ? 'pointer' : 'not-allowed',
          transition: 'background-color 0.2s ease'
        }}
      >
        {isLoading ? 'Sending Unlock Signal...' : isArrived ? '🔓 Unlock Doors' : '⏳ Waiting for Arrival...'}
      </button>
    </div>
  );
};
