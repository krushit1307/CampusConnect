// server/services/githubClassroomService.ts

import { Octokit } from '@octokit/rest';
import crypto from 'crypto';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Provisions student repositories for an Event Series from a template repository.
 */
export async function provisionClassroomRepositories(
    accessToken: string,
    orgName: string,
    templateRepo: string,
    studentGitHubHandles: string[]
): Promise<void> {
    const octokit = new Octokit({ auth: accessToken });

    for (const handle of studentGitHubHandles) {
        try {
            await octokit.repos.createUsingTemplate({
                template_owner: orgName,
                template_repo: templateRepo,
                name: `event-assignment-${handle}`,
                private: true,
            });
        } catch (err: any) {
            console.error(`Failed to provision repository for ${handle}:`, err.message);
        }
    }
}

/**
 * Verifies GitHub webhook signature for security.
 */
export function verifyGitHubSignature(reqBody: string, signatureHeader: string | undefined, secret: string): boolean {
    if (!signatureHeader) return false;
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(reqBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(digest));
}

/**
 * Automatically marks student as 'Attended' in CampusConnect upon passing PR submission.
 */
export async function markStudentAttendedByGitHubHandle(githubHandle: string, seriesId: string): Promise<void> {
    const client = await pool.connect();
    try {
        // Find user ID linked to GitHub handle
        const userRes = await client.query(
            `SELECT id FROM users WHERE github_handle = $1`,
            [githubHandle]
        );
        if (userRes.rows.length === 0) return;
        const userId = userRes.rows[0].id;

        // Mark attended for the event series session
        await client.query(
            `INSERT INTO event_attendance_ledger (user_id, series_id, status, verified_via, updated_at)
             VALUES ($1, $2, 'Attended', 'GitHub_Classroom_PR', NOW())
             ON CONFLICT (user_id, series_id) 
             DO UPDATE SET status = 'Attended', verified_via = 'GitHub_Classroom_PR', updated_at = NOW()`,
            [userId, seriesId]
        );
    } finally {
        client.release();
    }
}
