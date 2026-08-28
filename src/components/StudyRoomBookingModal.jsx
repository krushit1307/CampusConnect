// src/components/StudyRoomBookingModal.jsx

import React, { useState } from 'react';

export default function StudyRoomBookingModal({ room, isOpen, onClose, onBookingSuccess }) {
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSlots, setSelectedSlots] = useState([]);
    const [attendees, setAttendees] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const availableSlots = ['09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00'];

    if (!isOpen || !room) return null;

    const toggleSlot = (slot) => {
        if (selectedSlots.includes(slot)) {
            setSelectedSlots(selectedSlots.filter(s => s !== slot));
        } else {
            setSelectedSlots([...selectedSlots, slot]);
        }
    };

    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        if (!selectedDate || selectedSlots.length === 0) {
            setError('Please select a date and at least one time slot.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/study-rooms/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: room.id,
                    date: selectedDate,
                    timeSlots: selectedSlots,
                    attendeeCount: attendees,
                }),
            });

            if (!response.ok) throw new Error('Failed to reserve study room.');

            onBookingSuccess();
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Book {room.name}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
                </div>

                <p className="text-sm text-gray-600 mb-4">Building: <span className="font-semibold">{room.building}</span> | Max Capacity: {room.capacity}</p>

                {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

                <form onSubmit={handleBookingSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                            required 
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Time Slots (Multiple allowed)</label>
                        <div className="grid grid-cols-2 gap-2">
                            {availableSlots.map(slot => (
                                <button
                                    type="button"
                                    key={slot}
                                    onClick={() => toggleSlot(slot)}
                                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors ${
                                        selectedSlots.includes(slot) 
                                            ? 'bg-indigo-600 text-white border-indigo-600' 
                                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {slot}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Attendee Count</label>
                        <input 
                            type="number" 
                            min="1" 
                            max={room.capacity}
                            value={attendees} 
                            onChange={(e) => setAttendees(parseInt(e.target.value))}
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                            required 
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
                        >
                            {loading ? 'Reserving...' : 'Confirm Booking'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
