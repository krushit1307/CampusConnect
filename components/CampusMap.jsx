import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Custom question mark icon for mysterious secrets
const mysteryIcon = new L.Icon({
    iconUrl: '/assets/icons/mystery-marker.png',
    iconSize: [32, 32],
});

export default function CampusMap({ userId }) {
    const [secrets, setSecrets] = useState([]);
    const [showSecretsLayer, setShowSecretsLayer] = useState(false);
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        fetch(`/api/campus-secrets?user_id=${userId}`)
            .then(res => res.json())
            .then(data => setSecrets(data));
    }, [userId]);

    // Background Geolocation hook simulator for proximity triggers
    useEffect(() => {
        if (!showSecretsLayer) return;

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;

                // Send live coords to backend to verify proximity (< 10 meters)
                fetch('/api/campus-secrets/check-proximity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, latitude, longitude })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.newly_unlocked && data.newly_unlocked.length > 0) {
                        data.newly_unlocked.forEach(secret => {
                            setNotification(`🎉 You found: "${secret.title}"! +${secret.points_awarded} pts`);
                            // Refresh secrets state
                            setSecrets(prev => prev.map(s => s.id === secret.id ? { ...s, description: secret.description, is_unlocked: true } : s));
                        });
                    }
                });
            },
            (error) => console.error(error),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [showSecretsLayer, userId]);

    return (
        <div className="map-container-wrapper" style={{ position: 'relative', height: '100vh' }}>
            {/* UI Toggle Button */}
            <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 1000 }}>
                <button 
                    onClick={() => setShowSecretsLayer(!showSecretsLayer)}
                    style={{ background: showSecretsLayer ? '#088178' : '#fff', color: showSecretsLayer ? '#fff' : '#333', padding: '10px 15px', borderRadius: '8px', border: '1px solid #ccc', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    🗺️ {showSecretsLayer ? 'Hide Campus Secrets' : 'Discover Campus Secrets'}
                </button>
            </div>

            {/* Notification Banner for Unlocks */}
            {notification && (
                <div style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#f39c12', color: '#fff', padding: '12px 20px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontWeight: 'bold' }}>
                    {notification}
                </div>
            )}

            <MapContainer center={[30.7333, 76.7794]} zoom={16} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {/* Render Mystery Markers when toggle is active */}
                {showSecretsLayer && secrets.map(secret => (
                    <Marker 
                        key={secret.id} 
                        position={[secret.latitude, secret.longitude]}
                        icon={mysteryIcon}
                    >
                        <Popup>
                            <strong>{secret.title}</strong>
                            <p>{secret.description}</p>
                            {!secret.is_unlocked && <small style={{ color: '#e74c3c' }}>Walk within 10 meters to reveal!</small>}
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}
