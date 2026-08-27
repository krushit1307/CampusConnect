import React, { useState } from 'react';
import api from '../../utils/api'; // Adjust based on your API utility

export default function CapacitySlider({ event, venue, currentAttendance }) {
    const [capacity, setCapacity] = useState(event.capacity);
    const [isLoading, setIsLoading] = useState(false);

    const handleOverride = async () => {
        setIsLoading(true);
        try {
            await api.post(`/events/${event.id}/override-capacity`, { newCapacity: capacity });
            alert("Capacity updated! Waitlist is being processed.");
        } catch (error) {
            alert(error.response?.data?.message || error.message); 
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="capacity-override-panel p-4 border rounded shadow-sm">
            <h3 className="text-lg font-bold mb-4">Adjust Capacity</h3>
            
            <input 
                type="range" 
                className="w-full"
                // Hard-cap UI slider min to attendance to prevent accidental downscaling
                min={currentAttendance} 
                // Hard-cap UI slider max to fire code limits
                max={venue.maxCombinedCapacity} 
                value={capacity} 
                onChange={(e) => setCapacity(Number(e.target.value))} 
                disabled={isLoading}
            />
            
            <div className="flex justify-between mt-2 text-sm text-gray-600">
                <span>Current Check-ins: {currentAttendance}</span>
                <span className="font-bold text-blue-600">New Capacity: {capacity}</span>
                <span>Max: {venue.maxCombinedCapacity}</span>
            </div>

            <button 
                onClick={handleOverride}
                disabled={isLoading || capacity === event.capacity}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
                {isLoading ? "Updating..." : "Confirm Override"}
            </button>
        </div>
    );
}
