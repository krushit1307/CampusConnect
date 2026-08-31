// =============================================================================
// Component: DonationImpactCard
// Issue: #3709 - Develop a 'Dynamic "Alumni Donation" Tracker'
// Description: Shows a single donation linked to the event it funded, with
// attendee metrics and a mini photo gallery that makes the impact tangible.
// =============================================================================

import React from 'react';
import { DonationImpact } from '../../hooks/useDonationImpact';

interface DonationImpactCardProps {
    donation: DonationImpact;
}

export const DonationImpactCard: React.FC<DonationImpactCardProps> = ({ donation }) => {
    const { event } = donation;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            {/* Cover / gradient header */}
            <div className="relative h-36 bg-gradient-to-br from-indigo-500 to-purple-600">
                {event?.cover_image_url && (
                    <img src={event.cover_image_url} alt={event.title} className="w-full h-full object-cover opacity-90" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                    <p className="text-white/80 text-xs font-medium">{event?.club_name}</p>
                    <h3 className="text-white font-bold text-lg leading-tight truncate">
                        {event?.title || 'Unallocated Gift'}
                    </h3>
                </div>
            </div>

            <div className="p-5 space-y-4">
                {/* Amount + date */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">
                            ${donation.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Donated {new Date(donation.created_at).toLocaleDateString()}
                        </p>
                    </div>
                    {event && (
                        <div className="text-right">
                            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                                {event.attendee_count}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold">
                                Students Reached
                            </p>
                        </div>
                    )}
                </div>

                {/* Donor message */}
                {donation.message && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 italic border-l-2 border-indigo-300 dark:border-indigo-700 pl-3">
                        "{donation.message}"
                    </p>
                )}

                {/* Photo gallery */}
                {event && event.photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                        {event.photos.map((url, i) => (
                            <img
                                key={i}
                                src={url}
                                alt={`${event.title} photo ${i + 1}`}
                                className="w-full h-20 object-cover rounded-lg border border-gray-100 dark:border-gray-700"
                            />
                        ))}
                    </div>
                )}

                {/* Status */}
                {donation.impact_reported ? (
                    <p className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Impact report sent
                    </p>
                ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Impact report pending — you'll be notified when this event completes.
                    </p>
                )}
            </div>
        </div>
    );
};
