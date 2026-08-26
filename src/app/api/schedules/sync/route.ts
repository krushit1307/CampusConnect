import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncUserSchedule } from '@/lib/schedule/conflictChecker';

// Note: In a real implementation, you would use an ICS parser library like 'node-ical'
// This is a simplified mock parser for the artifact requirement.
function parseICSContent(icsContent: string, userId: string) {
    const blocks = [];
    const lines = icsContent.split('\n');
    let currentEvent: any = null;

    for (const line of lines) {
        if (line.startsWith('BEGIN:VEVENT')) {
            currentEvent = {};
        } else if (line.startsWith('END:VEVENT')) {
            if (currentEvent && currentEvent.summary) {
                // Mock extraction of day and time (simplified for artifact)
                blocks.push({
                    course_name: currentEvent.summary,
                    course_code: currentEvent.description || 'UNKNOWN',
                    day_of_week: 1, // Mock Monday
                    start_time: '09:00', // Mock time
                    end_time: '10:30', // Mock time
                    is_mandatory: true
                });
            }
            currentEvent = null;
        } else if (currentEvent) {
            if (line.startsWith('SUMMARY:')) currentEvent.summary = line.replace('SUMMARY:', '').trim();
            if (line.startsWith('DESCRIPTION:')) currentEvent.description = line.replace('DESCRIPTION:', '').trim();
        }
    }
    return blocks;
}

export async function POST(req: NextRequest) {
    try {
        const { userId, icsContent } = await req.json();

        if (!userId || !icsContent) {
            return NextResponse.json({ error: 'Missing userId or icsContent' }, { status: 400 });
        }

        const scheduleData = parseICSContent(icsContent, userId);
        await syncUserSchedule(userId, scheduleData);

        return NextResponse.json({
            success: true,
            message: `Successfully synced ${scheduleData.length} class blocks.`
        });
    } catch (error) {
        console.error('Schedule sync error:', error);
        return NextResponse.json({ error: 'Failed to sync schedule' }, { status: 500 });
    }
}
