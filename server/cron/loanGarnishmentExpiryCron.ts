// server/cron/loanGarnishmentExpiryCron.ts

import cron from 'node-cron';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Daily Cron Job (#4840): closes out Point Loans whose 3-month garnishment
 * window has passed, whether or not the debt was fully repaid.
 */
export function initLoanGarnishmentExpiryCron(): void {
    cron.schedule('0 3 * * *', async () => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const expiredRes = await client.query(`
                SELECT id, club_id FROM point_loans
                WHERE status = 'active' AND garnishment_expires_at < NOW()
            `);

            for (const loan of expiredRes.rows) {
                await client.query(
                    `UPDATE point_loans SET status = 'garnishment_expired', updated_at = NOW() WHERE id = $1`,
                    [loan.id],
                );
                await client.query(
                    `UPDATE clubs SET active_loan_id = NULL WHERE id = $1 AND active_loan_id = $2`,
                    [loan.club_id, loan.id],
                );
            }

            await client.query('COMMIT');
            console.log(`Loan garnishment expiry check completed. Closed ${expiredRes.rows.length} loans.`);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Failed to run loan garnishment expiry cron job:', err);
        } finally {
            client.release();
        }
    });
}