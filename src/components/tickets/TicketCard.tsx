// =============================================================================
// Component: TicketCard
// Issue: #2899 - Implement 'Offline Mode' Ticket Caching with Service Workers
//Description: Renders an individual event ticket with its QR code.
//Includes the "Download to Camera Roll" fallback button and handles
//image loading states gracefully when offline.
// =============================================================================

import React, { useState } from "react";
import { CachedTicket } from "../../hooks/useOfflineTickets";
import { CampusSafetyEscortModule } from "../events/CampusSafetyEscortModule";

interface TicketCardProps {
  ticket: CachedTicket;
  isOffline: boolean;
  onSaveToCameraRoll: (ticket: CachedTicket) => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  isOffline,
  onSaveToCameraRoll,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const eventDate = new Date(ticket.event_date);
  const formattedDate = eventDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const formattedTime = eventDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700 max-w-sm mx-auto">
            {/* Ticket Header / Stub */}
            <div className="bg-indigo-600 dark:bg-indigo-800 p-4 text-white relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12"></div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">
                    Admission Ticket
                </p>
                <h3 className="text-xl font-black leading-tight mb-2">
                    {ticket.event_title}
                </h3>
                {ticket.assigned_dietary_meal && (
                    <div className="bg-yellow-350 text-black border-2 border-black px-2.5 py-1 text-xs font-mono font-bold uppercase inline-block mb-3 shadow-[2px_2px_0_0_#000]" data-testid="dietary-yield-badge">
                        🎉 You get a {ticket.assigned_dietary_meal} meal!
                    </div>
                )}
                <div className="flex items-center gap-4 text-sm text-indigo-100">
                    <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formattedDate}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formattedTime}
                    </div>
                </div>
            </div>


      {/* Perforated Edge Effect */}
      <div className="relative h-4 bg-gray-50 dark:bg-gray-900">
        <div className="absolute left-0 top-0 w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full -translate-x-1/2 -translate-y-1/2 border-4 border-white dark:border-gray-800"></div>
        <div className="absolute right-0 top-0 w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full translate-x-1/2 -translate-y-1/2 border-4 border-white dark:border-gray-800"></div>
        <div className="absolute inset-x-8 top-1/2 border-t-2 border-dashed border-gray-300 dark:border-gray-700"></div>
      </div>

      {/* QR Code Body */}
      <div className="bg-gray-50 dark:bg-gray-900 p-6 flex flex-col items-center">
        <div className="relative w-56 h-56 bg-white p-4 rounded-xl shadow-inner mb-4">
          {!imageLoaded && !imageError && (
            <div className="absolute inset-4 animate-pulse bg-gray-200 dark:bg-gray-700 rounded"></div>
          )}

          <img
            src={ticket.qr_code_url}
            alt={`QR Code for ${ticket.event_title}`}
            className={`w-full h-full object-contain transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />

          {imageError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <svg
                className="w-12 h-12 text-red-500 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                {isOffline
                  ? "QR Code unavailable. You are offline and this ticket was not pre-cached."
                  : "Failed to load QR code."}
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-1 font-medium">
          {ticket.event_location}
        </p>
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 font-mono mb-4">
          ID: {ticket.id.substring(0, 8).toUpperCase()}
        </p>

        {ticket.event_end_time && (
          <div className="w-full mb-4">
            <CampusSafetyEscortModule
              eventTitle={ticket.event_title}
              eventVenue={ticket.event_location}
              eventEndTime={ticket.event_end_time}
              eventId={ticket.event_id}
            />
          </div>
        )}

        {/* Download Fallback Button */}
        <button
          onClick={() => onSaveToCameraRoll(ticket)}
          disabled={!imageLoaded || isOffline}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Save to Camera Roll
        </button>
      </div>
    </div>
  );
};
