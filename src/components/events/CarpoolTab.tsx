// =============================================================================
// Component: CarpoolTab
// Issue: #3222 - Develop a 'Carpool Coordination' Module for Off-Campus Events
// Description: The main "Transportation" tab on the Event Page. Displays 
// active carpool listings, allows passengers to request seats, and handles 
// the legal waiver gating.
// =============================================================================

import React, { useState } from 'react';
import { useCarpools, CarpoolListing } from '../../hooks/useCarpools';
import { CarpoolLegalWaiver } from './CarpoolLegalWaiver';
import { CarpoolDriverModal } from './CarpoolDriverModal';

interface CarpoolTabProps {
    eventId: string;
    isAttending: boolean;
}

export const CarpoolTab: React.FC<CarpoolTabProps> = ({ eventId, isAttending }) => {
    const {
        carpools, isLoading, error, hasSignedWaiver, signWaiver,
        requestSeat, updateRequestStatus, cancelCarpool
    } = useCarpools(eventId);

    const [showWaiver, setShowWaiver] = useState(false);
    const [showDriverModal, setShowDriverModal] = useState(false);

    if (!isAttending) {
        return (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400">You must RSVP to this event to view and join carpools.</p>
            </div>
        );
    }

    if (!hasSignedWaiver) {
        return (
            <div className="text-center py-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                <svg className="w-12 h-12 mx-auto text-amber-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">Waiver Required</h3>
                <p className="text-amber-700 dark:text-amber-400 mb-4 max-w-md mx-auto">
                    To participate in carpool coordination, you must first sign a mandatory liability waiver.
                </p>
                <button
                    onClick={() => setShowWaiver(true)}
                    className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-bold transition-colors"
                >
                    Read & Sign Waiver
                </button>
                {showWaiver && <CarpoolLegalWaiver onSign={signWaiver} onClose={() => setShowWaiver(false)} />}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Transportation & Carpools</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Coordinate rides with other attendees.</p>
                </div>
                <button
                    onClick={() => setShowDriverModal(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Offer a Ride
                </button>
            </div>

            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2].map(i => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>)}
                </div>
            ) : carpools.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400">No carpools have been organized yet. Be the first to offer a ride!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {carpools.map(carpool => (
                        <CarpoolCard
                            key={carpool.id}
                            carpool={carpool}
                            onRequestSeat={requestSeat}
                            onUpdateStatus={updateRequestStatus}
                            onCancel={cancelCarpool}
                        />
                    ))}
                </div>
            )}

            {showDriverModal && (
                <CarpoolDriverModal onClose={() => setShowDriverModal(false)} />
            )}
        </div>
    );
};

const CarpoolCard: React.FC<{
    carpool: CarpoolListing;
    onRequestSeat: (id: string) => Promise<boolean>;
    onUpdateStatus: (carpoolId: string, passengerId: string, status: 'accepted' | 'rejected') => Promise<boolean>;
    onCancel: (id: string) => Promise<boolean>;
}> = ({ carpool, onRequestSeat, onUpdateStatus, onCancel }) => {

    const departureTime = new Date(carpool.departure_time).toLocaleString();

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold">
                        {carpool.profiles?.full_name?.charAt(0) || 'D'}
                    </div>
                    <div>
                        <p className="font-bold text-gray-900 dark:text-white">{carpool.profiles?.full_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{carpool.vehicle_description || 'Vehicle details not provided'}</p>
                    </div>
                </div>
                <span className={`px-2 py-1 text-xs font-bold rounded-full ${carpool.available_seats > 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                    {carpool.available_seats} / {carpool.total_seats} Seats
                </span>
            </div>

            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300 mb-4">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{carpool.departure_location}</span>
                </div>
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{departureTime}</span>
                </div>
            </div>

            {carpool.notes && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-4 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                    "{carpool.notes}"
                </p>
            )}

            <button
                onClick={() => onRequestSeat(carpool.id)}
                disabled={carpool.available_seats === 0}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
            >
                {carpool.available_seats === 0 ? 'Carpool Full' : 'Request Seat'}
            </button>
        </div>
    );
};
