// server/routes/githubWebhookRoutes.ts

import { Router, Request, Response } from 'express';
import { verifyGitHubSignature, markStudentAttendedByGitHubHandle } from '../services/githubClassroomService';

const router = Router();
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'mock_secret';

router.post('/webhooks/github-classroom', async (req: Request, res: Response) => {
    const signature = req.headers['x-hub-signature-256'] as string;
    const rawBody = JSON.stringify(req.body);

    if (!verifyGitHubSignature(rawBody, signature, WEBHOOK_SECRET)) {
        return res.status(401).json({ error: 'Invalid GitHub webhook signature.' });
    }

    const event = req.headers['x-github-event'];

    // Listen for pull request closure / success events
    if (event === 'pull_request' && req.body.action === 'closed' && req.body.pull_request.merged === true) {
        const githubHandle = req.body.pull_request.user.login;
        const repoName = req.body.repository.name;
        
        // Extract series ID from repository naming convention or metadata store
        const seriesId = req.body.repository.description || 'default-series-id';

        try {
            await markStudentAttendedByGitHubHandle(githubHandle, seriesId);
            return res.status(200).json({ message: 'Attendance automatically verified and updated via GitHub PR.' });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(200).json({ message: 'Event received and ignored.' });
});

export default router;
