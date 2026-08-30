// server/services/studyRoomService.ts

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface StudyRoom {
    id: string;
    name: string;
    building: string;
    capacity: number;
    amenities: string[];
    is_available: boolean;
}

/**
 * Searches and filters study rooms by building, capacity, and amenities.
 */
export async function searchStudyRooms(building?: string, minCapacity?: number, amenity?: string): Promise<StudyRoom[]> {
    const client = await pool.connect();
    try {
        let query = `SELECT * FROM study_rooms WHERE 1=1`;
        const params: any[] = [];
        let paramIndex = 1;

        if (building) {
            query += ` AND building = $${paramIndex++}`;
            params.push(building);
        }
        if (minCapacity) {
            query += ` AND capacity >= $${paramIndex++}`;
            params.push(minCapacity);
        }
        if (amenity) {
            query += ` AND $${paramIndex++} = ANY(amenities)`;
            params.push(amenity);
        }

        const res = await client.query<StudyRoom>(query, params);
        return res.rows;
    } finally {
        client.release();
    }
}

/**
 * Creates a study room booking with conflict checks across selected time slots.
 */
export async function bookStudyRoom(userId: string, roomId: string, date: string, timeSlots: string[], attendeeCount: number): Promise<string> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check for existing bookings on the same room, date, and overlapping time slots
        const conflictRes = await client.query(
            `SELECT * FROM study_room_bookings 
             WHERE room_id = $1 AND booking_date = $2 AND time_slot = ANY($3) AND status = 'Confirmed'`,
            [roomId, date, timeSlots]
        );

        if (conflictRes.rows.length > 0) {
            throw new Error('One or more selected time slots are already booked.');
        }

        const bookingId = crypto.randomUUID();
        for (const slot of timeSlots) {
            await client.query(
                `INSERT INTO study_room_bookings (id, user_id, room_id, booking_date, time_slot, attendee_count, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, 'Confirmed', NOW())`,
                [crypto.randomUUID(), userId, roomId, date, slot, attendeeCount]
            );
        }

        await client.query('COMMIT');
        return bookingId;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}
