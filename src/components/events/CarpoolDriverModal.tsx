// =============================================================================
// Component: CarpoolDriverModal
// Issue: #3222 - Develop a 'Carpool Coordination' Module for Off - Campus Events
// Description: Modal for drivers to create a new carpool listing, specifying
// seats, departure location, time, and vehicle details.
// =============================================================================

import React, { useState } from 'react';
import { useCarpools } from '../../hooks/useCarpools';

interface CarpoolDriverModalProps {
    onClose: () => void;
}

export const CarpoolDriverModal: React.FC<CarpoolDriverModalProps> = ({ onClose }) => {
    const { createCarpool } = useCarpools(null); // Hook context handled by parent
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        total_seats: 3,
        departure_location: '',
        departure_time: '',
        vehicle_description: '',
        notes: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const success = await createCarpool({
            ...formData,
            total_seats: Number(formData.total_seats),
            departure_time: new Date(formData.departure_time).toISOString(),
            available_seats: Number(formData.total_seats),
            is_cancelled: false
        });

        setIsSubmitting(false);
        if (success) onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Offer a Ride</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Fill out the details for your carpool listing.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Available Seats</label>
                            <input
                                type="number"
                                min="1"
                                max="8"
                                value={formData.total_seats}
                                onChange={(e) => setFormData({ ...formData, total_seats: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Departure Time</label>
                            <input
                                type="datetime-local"
                                value={formData.departure_time}
                                onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Departure Location</label>
                        <input
                            type="text"
                            value={formData.departure_location}
                            onChange={(e) => setFormData({ ...formData, departure_location: e.target.value })}
                            placeholder="e.g., Main Campus Library Parking Lot"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vehicle Description</label>
                        <input
                            type="text"
                            value={formData.vehicle_description}
                            onChange={(e) => setFormData({ ...formData, vehicle_description: e.target.value })}
                            placeholder="e.g., Blue Honda Civic"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Additional Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            placeholder="e.g., I can fit skis on the roof rack."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-bold">
                            {isSubmitting ? 'Creating...' : 'Publish Listing'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
