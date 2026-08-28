import React, { useState, useEffect } from 'react';
import { MapPin, Lock, Unlock, CheckCircle2, RefreshCcw, Globe, ShieldCheck, AlertTriangle, Navigation, Zap, Search, ArrowRight } from 'lucide-react';

interface GeoLocation {
  latitude: number;
  longitude: number;
}

const SECRET_URL = "https://campusconnect.edu/early-bird-secret/2026";
const TARGET_LOCATION: GeoLocation = { latitude: 18.5204, longitude: 73.8567 }; // Pune, India
const ALLOWED_RADIUS_KM = 5;

export default function GeofencedUnlocking() {
  const [userLocation, setUserLocation] = useState<GeoLocation | null>(null);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [notification, setNotification] = useState('');

  // Simulate getting user location
  const simulateLocation = () => {
    setIsChecking(true);
    setNotification('Checking your location...');
    setTimeout(() => {
      // Simulating a location within the allowed radius
      const simulatedLocation: GeoLocation = { latitude: 18.5204, longitude: 73.8567 };
      setUserLocation(simulatedLocation);
      setIsChecking(false);
      setNotification('Location verified successfully!');
      setIsUnlocked(true);
      setTimeout(() => setNotification(''), 3000);
    }, 2000);
  };

  const resetSystem = () => {
    setUserLocation(null);
    setIsUnlocked(false);
    setIsChecking(false);
    setNotification('');
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const distance = userLocation ? calculateDistance(
    userLocation.latitude, userLocation.longitude, 
    TARGET_LOCATION.latitude, TARGET_LOCATION.longitude
  ) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="bg-gradient-to-r from-yellow-900/60 via-amber-900/40 to-slate-900 border border-yellow-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute -right-10 -top-10 w-72 h-72 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-yellow-500/20 text-yellow-300 text-xs px-3 py-1 rounded-full font-semibold border border-yellow-500/30 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5" /> Location-Based
                </span>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-400" /> Geofenced Security
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-yellow-200 bg-clip-text text-transparent">
                Dynamic Early Bird Secret URL Geofenced Unlocking
              </h1>
              <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                Unlock a secret early bird URL only when users are within a specific geographic radius.
              </p>
            </div>
            <button onClick={resetSystem} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl font-medium transition flex items-center gap-2 border border-slate-700 text-sm">
              <RefreshCcw className="w-4 h-4" /> Reset System
            </button>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Location Check */}
          <div className="bg-slate-900/80 border border-yellow-500/20 rounded-3xl p-8">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><MapPin className="w-5 h-5 text-yellow-400" /> Location Verification</h2>
            
            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-yellow-500/10 rounded-xl">
                    <Globe className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Target Location</p>
                    <p className="font-bold text-white">Pune, India (18.52°N, 73.85°E)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/10 rounded-xl">
                    <Navigation className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Allowed Radius</p>
                    <p className="font-bold text-white">{ALLOWED_RADIUS_KM} Kilometers</p>
                  </div>
                </div>
              </div>

              {!userLocation && (
                <button 
                  onClick={simulateLocation}
                  disabled={isChecking}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-xl font-medium transition shadow-lg shadow-yellow-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isChecking ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                  {isChecking ? 'Checking Location...' : 'Simulate Location Check'}
                </button>
              )}

              {userLocation && (
                <div className="space-y-4">
                  <div className="bg-slate-800/50 rounded-2xl p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-400 text-sm">Your Distance</span>
                      <span className="font-bold text-white">{distance?.toFixed(2)} km</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div className={`h-2 rounded-full ${isUnlocked ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min((distance / ALLOWED_RADIUS_KM) * 100, 100)}%` }} />
                    </div>
                  </div>
                  
                  {isUnlocked ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                      <Unlock className="w-6 h-6 text-emerald-400" />
                      <p className="text-emerald-300 font-bold">Location Verified! URL Unlocked.</p>
                    </div>
                  ) : (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-3">
                      <Lock className="w-6 h-6 text-rose-400" />
                      <p className="text-rose-300 font-bold">You are outside the allowed radius.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Secret URL Display */}
          <div className="bg-slate-900/80 border border-yellow-500/20 rounded-3xl p-8">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><Lock className="w-5 h-5 text-yellow-400" /> Secret URL Access</h2>
            
            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-2xl p-6 text-center">
                <p className="text-sm text-slate-400 mb-4">Secret Early Bird URL</p>
                <div className={`p-4 rounded-xl border font-mono text-sm break-all ${
                  isUnlocked ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-500'
                }`}>
                  {isUnlocked ? SECRET_URL : '••••••••••••••••••••••••••••••••••'}
                </div>
              </div>

              {isUnlocked ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <p className="text-emerald-300 font-bold">Access Granted! Copy the URL and enjoy early bird pricing.</p>
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-yellow-400" />
                  <p className="text-yellow-300 font-bold">Verify your location to unlock the secret URL.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-sm text-yellow-300 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            {notification}
          </div>
        )}

        {/* Security Footer */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-yellow-500/20 rounded-full">
            <ShieldCheck className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h3 className="font-bold text-yellow-300">Geofenced Security</h3>
            <p className="text-slate-400 text-sm">This is a standalone simulation. It does not modify any existing backend data.</p>
          </div>
        </div>

      </div>
    </div>
  );
}

