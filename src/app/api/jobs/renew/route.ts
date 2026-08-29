import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const token = searchParams.get('token');
        const jobId = searchParams.get('jobId');

        if (!token || !jobId) {
            return NextResponse.json(
                { error: 'Missing token or jobId parameters' },
                { status: 400 }
            );
        }

        // Verify the renewal token matches the job
        const { data: job, error: fetchError } = await supabase
            .from('alumni_jobs')
            .select('id, status, expires_at, renewal_token')
            .eq('id', jobId)
            .eq('renewal_token', token)
            .single();

        if (fetchError || !job) {
            return NextResponse.json(
                { error: 'Invalid or expired renewal link' },
                { status: 404 }
            );
        }

        if (job.status === 'filled') {
            return NextResponse.json(
                { error: 'This job has already been marked as filled and cannot be renewed' },
                { status: 400 }
            );
        }

        // Extend expiration by 30 days from now (or from current expiration if still active)
        const baseDate = job.status === 'active' ? new Date(job.expires_at) : new Date();
        const newExpiresAt = new Date(baseDate);
        newExpiresAt.setDate(newExpiresAt.getDate() + 30);

        // Generate a new renewal token for future use
        const { v4: uuidv4 } = await import('uuid');
        const newToken = uuidv4();

        const { error: updateError } = await supabase
            .from('alumni_jobs')
            .update({
                status: 'active',
                expires_at: newExpiresAt.toISOString(),
                renewal_token: newToken,
                archived_at: null
            })
            .eq('id', jobId);

        if (updateError) {
            throw new Error(updateError.message);
        }

        // Redirect to alumni dashboard with success message
        const redirectUrl = new URL('/alumni/dashboard/jobs?renewal=success', req.url);
        return NextResponse.redirect(redirectUrl);

    } catch (error) {
        console.error('Job renewal error:', error);
        return NextResponse.json(
            { error: 'Failed to process job renewal' },
            { status: 500 }
        );
    }
}
