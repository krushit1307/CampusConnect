'use client';

import { useState, useEffect } from 'react';
import { getGoogleAuthUrl, getCalendarEventsForDate, checkTemporalIntersection } from '@/lib/calendar/googleCalendar';
import { useAuth } from '@/lib/auth';

interface RSVPWithCalendarCheckProps {
    eventId: string;
    eventStart: string;
    eventEnd: string;
    onRSVP: () => Promise<void>;
}

export default function RSVPWithCalendarCheck({ eventId, eventStart, eventEnd, onRSVP }: RSVPWithCalendarCheckProps) {
    const { user } = useAuth();
    const [isChecking, setIsChecking] = useState(false);
    const [conflicts, setConflicts] = useState<{ title: string; startTime: string; endTime: string }[]>([]);
    const [showWarning, setShowWarning] = useState(false);
    const [forceRSVP, setForceRSVP] = useState(false);

    const handleRSVPClick = async () => {
        if (!user) {
            // Handle unauthenticated state
            return;
        }

        setIsChecking(true);

        try {
            // Fetch calendar events for the event date
            const dateOnly = eventStart.split('T')[0];
            const calendarData = await getCalendarEventsForDate(user.id, dateOnly);

            const eventStartDate = new Date(eventStart);
            const eventEndDate = new Date(eventEnd);

            const detectedConflicts = checkTemporalIntersection(
                eventStartDate,
                eventEndDate,
                calendarData.conflictingEvents
            );

            if (detectedConflicts.length > 0 && !forceRSVP) {
                setConflicts(detectedConflicts);
                setShowWarning(true);
            } else {
                await onRSVP();
            }
        } catch (error) {
            console.error('Calendar check failed:', error);
            // Fail open: allow RSVP if calendar check fails
            await onRSVP();
        } finally {
            setIsChecking(false);
        }
    };

    if (showWarning) {
        return (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-xl p-6">
                <div className="flex items-start space-x-3 mb-4">
                    <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200">
                            Schedule Conflict Detected!
                        </h3>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            You have the following scheduled during this event:
                        </p>
                    </div>
                </div>

                <ul className="space-y-2 mb-6">
                    {conflicts.map((conflict, idx) => (
                        <li key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-yellow-200 dark:border-yellow-700">
                            <p className="font-semibold text-gray-900 dark:text-white">{conflict.title}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {conflict.startTime} - {conflict.endTime}
                            </p>
                        </li>
                    ))}
                </ul>

                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                    Are you sure you want to RSVP? You may miss your scheduled commitment.
                </p>

                <div className="flex space-x-3">
                    <button
                        onClick={() => setShowWarning(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Cancel RSVP
                    </button>
                    <button
                        onClick={() => {
                            setForceRSVP(true);
                            handleRSVPClick();
                        }}
                        className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors"
                    >
                        Yes, RSVP Anyway
                    </button>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={handleRSVPClick}
            disabled={isChecking}
            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-xl shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
            {isChecking ? (
                <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Checking Calendar...</span>
                </>
            ) : (
                <span>RSVP to Event</span>
            )}
        </button>
    );
}
