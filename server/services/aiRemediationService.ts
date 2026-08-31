// server/services/aiRemediationService.ts

import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Keep prompts small so we stay well inside the LLM's context window.
const MAX_LOG_CHARS = 4000;
const MAX_DIFF_CHARS = 4000;

/**
 * Downloads the raw console output for a failed GitHub Actions check run.
 * Only the final slice of the log is kept, since that's where the actual
 * failure/stack trace almost always lives.
 */
export async function fetchFailedCheckLogs(
    octokit: Octokit,
    owner: string,
    repo: string,
    checkRunId: number
): Promise<string> {
    const checkRun = await octokit.request('GET /repos/{owner}/{repo}/check-runs/{check_run_id}', {
        owner,
        repo,
        check_run_id: checkRunId,
    });

    const jobId = (checkRun.data as any).external_id || checkRunId;

    const logResponse = await octokit.request('GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs', {
        owner,
        repo,
        job_id: jobId,
    });

    const rawLog = typeof logResponse.data === 'string' ? logResponse.data : String(logResponse.data);
    return rawLog.slice(-MAX_LOG_CHARS);
}

/**
 * Fetches the unified diff for the student's pull request.
 */
export async function fetchPullRequestDiff(
    octokit: Octokit,
    owner: string,
    repo: string,
    pullNumber: number
): Promise<string> {
    const response = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
        mediaType: { format: 'diff' },
    });

    const diff = response.data as unknown as string;
    return diff.slice(0, MAX_DIFF_CHARS);
}

/**
 * Sends the failing log and code diff to the LLM and returns a short,
 * friendly explanation plus a hint at the fix.
 */
export async function generateRemediationFeedback(diff: string, log: string): Promise<string> {
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'system',
                content:
                    'You are a friendly TA. Explain why this test failed in one paragraph, and provide a small code snippet hinting at the solution.',
            },
            {
                role: 'user',
                content: `Here is the student's code diff:\n\n${diff}\n\nHere is the CI/CD error log:\n\n${log}`,
            },
        ],
        max_tokens: 500,
    });

    return (
        completion.choices[0]?.message?.content?.trim() ||
        "The automated tutor couldn't generate feedback for this failure. Please review the CI logs manually."
    );
}

/**
 * Posts the generated remediation feedback as a comment on the student's PR.
 */
export async function postRemediationComment(
    octokit: Octokit,
    owner: string,
    repo: string,
    pullNumber: number,
    feedback: string
): Promise<void> {
    const commentBody = `### 🤖 Automated Test Feedback\n\n${feedback}\n\n*This is an automated message to help you understand and fix the failing test. Feel free to ask a mentor if you're still stuck!*`;

    await octokit.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body: commentBody,
    });
}