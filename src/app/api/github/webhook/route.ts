import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchGitHubCommits, analyzeCommitHistory } from '@/lib/github/commitAnalyzer';
import { WebhookPayload } from '@/types/github';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const body: WebhookPayload = await req.json();

        // Only process merged pull requests
        if (body.action !== 'closed' || !body.pull_request?.merged) {
            return NextResponse.json({ message: 'Ignored: Not a merged PR' }, { status: 200 });
        }

        const githubUsername = body.pull_request.user.login;
        const repoUrl = body.repository.url;

        // 1. Find the user in our system by GitHub username (simplified mapping)
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, series_id')
            .eq('github_username', githubUsername)
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found in CampusConnect' }, { status: 404 });
        }

        // 2. Fetch and analyze commits
        const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
        if (!githubToken) {
            throw new Error('GitHub token not configured');
        }

        const commits = await fetchGitHubCommits(repoUrl, githubToken);
        const analysis = analyzeCommitHistory(commits);

        // 3. Update submission status based on analysis
        const newStatus = analysis.isSuspicious ? 'pending_audit' : 'attended';

        const { error: updateError } = await supabase
            .from('user_series_progress')
            .update({
                submission_status: newStatus,
                audit_reason: analysis.flagReason,
                commit_count: analysis.totalCommits,
                lines_changed: analysis.totalLinesChanged,
            })
            .eq('user_id', user.id)
            .eq('series_id', user.series_id);

        if (updateError) {
            throw new Error(updateError.message);
        }

        // 4. If suspicious, trigger alert to Organizer (mocked)
        if (analysis.isSuspicious) {
            console.log(`[ALERT] Suspicious GitHub activity detected for user ${githubUsername}: ${analysis.flagReason}`);
            // In production: send email/Slack webhook to series organizer
        }

        return NextResponse.json({
            success: true,
            status: newStatus,
            analysis,
        });

    } catch (error) {
        console.error('GitHub webhook error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
