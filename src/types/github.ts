/**
 * GitHub Integration and Verification Types for CampusConnect
 * Defines interfaces for commit analysis and heuristic flagging.
 */

export interface GitHubCommit {
    sha: string;
    commit: {
        author: { date: string };
        message: string;
    };
    stats: {
        additions: number;
        deletions: number;
        total: number;
    };
}

export interface CommitAnalysisResult {
    totalCommits: number;
    totalLinesChanged: number;
    commitVelocity: number; // lines changed per minute
    isSuspicious: boolean;
    flagReason: string;
}

export interface WebhookPayload {
    action: string;
    repository: {
        name: string;
        url: string;
    };
    pull_request?: {
        number: number;
        merged: boolean;
        user: { login: string };
    };
}

export interface StudentSubmission {
    user_id: string;
    series_id: string;
    github_repo_url: string;
    submission_status: 'pending' | 'attended' | 'pending_audit' | 'rejected';
    audit_reason: string | null;
    commit_count: number;
    lines_changed: number;
    analyzed_at: string | null;
    user_name: string;
    user_email: string;
}
