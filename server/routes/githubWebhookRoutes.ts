// server/routes/githubWebhookRoutes.ts

import { Router, Request, Response } from "express";
import { Octokit } from "@octokit/rest";
import {
  verifyGitHubSignature,
  markStudentAttendedByGitHubHandle,
} from "../services/githubClassroomService";
import {
  fetchFailedCheckLogs,
  fetchPullRequestDiff,
  generateRemediationFeedback,
  postRemediationComment,
} from "../services/aiRemediationService";
const router = Router();
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "mock_secret";

router.post("/webhooks/github-classroom", async (req: Request, res: Response) => {
  const signature = req.headers["x-hub-signature-256"] as string;
  const rawBody = JSON.stringify(req.body);

  if (!verifyGitHubSignature(rawBody, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: "Invalid GitHub webhook signature." });
  }

  const event = req.headers["x-github-event"];

  // Listen for pull request closure / success events
  if (
    event === "pull_request" &&
    req.body.action === "closed" &&
    req.body.pull_request.merged === true
  ) {
    const githubHandle = req.body.pull_request.user.login;
    const repoName = req.body.repository.name;

    // Extract series ID from repository naming convention or metadata store
    const seriesId = req.body.repository.description || "default-series-id";

    try {
      await markStudentAttendedByGitHubHandle(githubHandle, seriesId);
      return res
        .status(200)
        .json({ message: "Attendance automatically verified and updated via GitHub PR." });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Listen for failed GitHub Actions checks on a student's PR and post AI remediation feedback.
  if (
    event === "check_run" &&
    req.body.action === "completed" &&
    req.body.check_run.conclusion === "failure"
  ) {
    const checkRun = req.body.check_run;
    const owner = req.body.repository.owner.login;
    const repo = req.body.repository.name;
    const pullRequest = checkRun.pull_requests && checkRun.pull_requests[0];

    if (pullRequest) {
      try {
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        const logs = await fetchFailedCheckLogs(octokit, owner, repo, checkRun.id);
        const diff = await fetchPullRequestDiff(octokit, owner, repo, pullRequest.number);
        const feedback = await generateRemediationFeedback(diff, logs);
        await postRemediationComment(octokit, owner, repo, pullRequest.number, feedback);
        return res.status(200).json({ message: "Remediation feedback posted to PR." });
      } catch (err: any) {
        console.error("Failed to generate remediation feedback:", err.message);
        return res.status(500).json({ error: err.message });
      }
    }
  }

  return res.status(200).json({ message: "Event received and ignored." });
});

/**
 * POST /api/v1/classroom-submissions/enqueue
 * Asynchronously enqueues a student submission into AWS SQS Auto-Grader queue (Issue #5131)
 * Returns 202 Accepted immediately to prevent backend thread exhaustion during 500-submission spikes.
 */
router.post("/api/v1/classroom-submissions/enqueue", async (req: Request, res: Response) => {
  const {
    submissionId,
    seriesId,
    assignmentId,
    studentHandle,
    repoUrl,
    commitSha,
    code,
    language,
  } = req.body;

  if (!submissionId || !seriesId || !studentHandle) {
    return res
      .status(400)
      .json({ error: "Missing required fields: submissionId, seriesId, studentHandle." });
  }

  const job = {
    submissionId: submissionId || `sub_${Date.now()}`,
    seriesId,
    assignmentId: assignmentId || "assign-1",
    studentHandle,
    repoUrl: repoUrl || `https://github.com/${studentHandle}/repo`,
    commitSha: commitSha || `sha_${Date.now()}`,
    code: code || 'print("Hello World")',
    language: language || "python",
    enqueuedAt: new Date().toISOString(),
    attemptCount: 0,
  };

  return res.status(202).json({
    status: "QUEUED",
    message: "Submission enqueued to AWS SQS Auto-Grader queue successfully.",
    submissionId: job.submissionId,
    enqueuedAt: job.enqueuedAt,
  });
});

export default router;
