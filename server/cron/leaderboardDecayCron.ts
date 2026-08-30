// server/cron/leaderboardDecayCron.ts

import cron from 'node-cron';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Weekly Cron Job evaluating club inactivity and applying point decay.
 * Runs every Monday at midnight.
 */
export function initLeaderboardDecayCron(): void {
    cron.schedule('0 0 * * 1', async () => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Fetch clubs and their last event date & total points
            const clubsRes = await client.query(`
                SELECT id, total_points, last_event_date, 
                       EXTRACT(DAY FROM (NOW() - last_event_date)) AS inactive_days
                FROM clubs
            `);

            for (const club of clubsRes.rows) {
                const inactiveDays = club.inactive_days || 0;
                let decayRate = 0;

                if (inactiveDays > 60) {
                    decayRate = 0.10; // 10% decay per week after 60 days
                } else if (inactiveDays > 30) {
                    decayRate = 0.05; // 5% decay per week after 30 days
                }

                if (decayRate > 0) {
                    const newPoints = Math.round(club.total_points * (1 - decayRate));
                    
                    await client.query(
                        `UPDATE clubs SET total_points = $1, decay_penalty_active = TRUE, updated_at = NOW() WHERE id = $2`,
                        [newPoints, club.id]
                    );
                } else {
                    await client.query(
                        `UPDATE clubs SET decay_penalty_active = FALSE WHERE id = $1`,
                        [club.id]
                    );
                }
            }

            await client.query('COMMIT');
            console.log('Leaderboard decay evaluation completed successfully.');
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Failed to run leaderboard decay cron job:', err);
        } finally {
            client.release();
        }
    });
}
