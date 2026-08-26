import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXT_PUBLIC_APP_URL + '/api/auth/google/callback'
);

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const code = searchParams.get('code');
        const state = searchParams.get('state'); // Should contain userId

        if (!code || !state) {
            return NextResponse.redirect(new URL('/events?error=missing_params', req.url));
        }

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Store tokens in database
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expiry_date ? tokens.expiry_date / 1000 : 3600));

        const { error } = await supabase.from('user_calendar_tokens').upsert({
            user_id: state,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: expiresAt.toISOString(),
        });

        if (error) {
            throw new Error(error.message);
        }

        return NextResponse.redirect(new URL('/events?calendar_connected=true', req.url));
    } catch (error) {
        console.error('Google OAuth callback error:', error);
        return NextResponse.redirect(new URL('/events?error=oauth_failed', req.url));
    }
}
