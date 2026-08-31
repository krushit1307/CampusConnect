/**
 * Calendar Integration Types for CampusConnect
 * Defines interfaces for Google Calendar OAuth and conflict detection.
 */

export interface GoogleCalendarEvent {
    id: string;
    summary: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
}

export interface CalendarConflict {
    hasConflict: boolean;
    conflictingEvents: {
        title: string;
        startTime: string;
        endTime: string;
    }[];
}

export interface UserCalendarToken {
    user_id: string;
    access_token: string;
    refresh_token: string;
    expires_at: string;
}
