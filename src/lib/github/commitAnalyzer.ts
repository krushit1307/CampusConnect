import { GitHubCommit, CommitAnalysisResult } from '@/types/github';

/**
 * Analyzes a GitHub repository's commit history to detect non-organic coding behavior.
 * 
 * @param commits - Array of commits from the GitHub API
 * @returns CommitAnalysisResult
 */
export function analyzeCommitHistory(commits: GitHubCommit[]): CommitAnalysisResult {
    if (commits.length === 0) {
        return {
            totalCommits: 0,
            totalLinesChanged: 0,
            commitVelocity: 0,
            isSuspicious: true,
            flagReason: 'No commits found in repository.',
        };
    }

    const totalCommits = commits.length;
    const totalLinesChanged = commits.reduce((sum, commit) => sum + (commit.stats?.total || 0), 0);

    // Calculate time span between first and last commit
    const firstCommitDate = new Date(commits[commits.length - 1].commit.author.date).getTime();
    const lastCommitDate = new Date(commits[0].commit.author.date).getTime();
    const durationMinutes = Math.max(1, (lastCommitDate - firstCommitDate) / (1000 * 60));

    const commitVelocity = totalLinesChanged / durationMinutes;

    // Heuristic flagging: Single commit with massive code dump
    let isSuspicious = false;
    let flagReason = '';

    if (totalCommits === 1 && totalLinesChanged > 1000) {
        isSuspicious = true;
        flagReason = `Suspicious Activity: Student submitted a massive chunk of code (${totalLinesChanged} lines) in a single commit. Please review for plagiarism or copy-pasting.`;
    } else if (commitVelocity > 500 && totalLinesChanged > 500) {
        isSuspicious = true;
        flagReason = `Suspicious Activity: Abnormally high commit velocity (${commitVelocity.toFixed(1)} lines/min). Possible automated script or bulk upload.`;
    }

    return {
        totalCommits,
        totalLinesChanged,
        commitVelocity,
        isSuspicious,
        flagReason,
    };
}

/**
 * Fetches commits from GitHub API for a specific repository.
 */
export async function fetchGitHubCommits(repoUrl: string, token: string): Promise<GitHubCommit[]> {
    // Extract owner and repo from URL (e.g., https://github.com/owner/repo)
    const urlParts = repoUrl.replace('https://github.com/', '').split('/');
    if (urlParts.length < 2) {
        throw new Error('Invalid GitHub repository URL');
    }

    const owner = urlParts[0];
    const repo = urlParts[1].replace('.git', '');

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
        },
    });

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Fetch detailed stats for each commit (simplified for this implementation)
    // In production, you would batch these requests or use GraphQL
    const commitsWithStats: GitHubCommit[] = [];
    for (const item of data.slice(0, 10)) { // Limit to last 10 for performance
        const detailResponse = await fetch(item.url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });
        if (detailResponse.ok) {
            commitsWithStats.push(await detailResponse.json());
        }
    }

    return commitsWithStats;
}