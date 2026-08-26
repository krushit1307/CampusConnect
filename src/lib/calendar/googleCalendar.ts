import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { CalendarConflict } from '@/types/calendar';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXT_PUBLIC_APP_URL + '/api/auth/google/callback'
);

/**
 * Fetches the user's calendar events for a specific date.
 */
export async function getCalendarEventsForDate(userId: string, targetDate: string): Promise<CalendarConflict> {
    // 1. Fetch stored tokens
    const { data: tokenData, error: tokenError } = await supabase
        .from('user_calendar_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (tokenError || !tokenData) {
        // User has not connected their calendar
        return { hasConflict: false, conflictingEvents: [] };
    }

    // 2. Refresh token if necessary (simplified for this implementation)
    oauth2Client.setCredentials({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // 3. Fetch events for the specific date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    try {
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items || [];

        return {
            hasConflict: events.length > 0,
            conflictingEvents: events.map(event => ({
                title: event.summary || 'Busy',
                startTime: event.start?.dateTime || event.start?.date || '',
                endTime: event.end?.dateTime || event.end?.date || '',
            }))
        };
    } catch (error) {
        console.error('Google Calendar API error:', error);
        return { hasConflict: false, conflictingEvents: [] };
    }
}

/**
 * Checks for temporal intersection between a club event and calendar blocks.
 */
export function checkTemporalIntersection(
    eventStart: Date,
    eventEnd: Date,
    calendarEvents: { startTime: string; endTime: string }[]
): { title: string; startTime: string; endTime: string }[] {
    const conflicts = [];

    for (const calEvent of calendarEvents) {
        const calStart = new Date(calEvent.startTime);
        const calEnd = new Date(calEvent.endTime);

        // Intersection logic: (StartA <= EndB) and (EndA >= StartB)
        if (eventStart <= calEnd && eventEnd >= calStart) {
            conflicts.push({
                title: calEvent.title,
                startTime: calStart.toLocaleTimeString(),
                endTime: calEnd.toLocaleTimeString(),
            });
        }
    }

    return conflicts;
}

export function getGoogleAuthUrl() {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar.readonly'],
        prompt: 'consent',
    });
}
