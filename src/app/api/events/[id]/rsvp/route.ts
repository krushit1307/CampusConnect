import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyRecaptchaToken } from '@/lib/security/recaptcha';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const eventId = params.id;
        const { userId, recaptchaToken, phoneNumber } = await req.json();

        if (!userId || !recaptchaToken) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        // 1. Verify reCAPTCHA token
        const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
        const verification = await verifyRecaptchaToken(recaptchaToken, ip);

        if (!verification.success) {
            return NextResponse.json(
                { error: 'reCAPTCHA verification failed' },
                { status: 400 }
            );
        }

        // 2. Check score
        if (verification.score >= 0.7) {
            // Approve normally
            const { error: rsvpError } = await supabase
                .from('event_registrations')
                .insert({ event_id: eventId, user_id: userId, status: 'confirmed' });

            if (rsvpError) throw new Error(rsvpError.message);

            return NextResponse.json({ success: true, requiresOtp: false, message: 'RSVP successful' });
        } else {
            // 3. Score < 0.7: Trigger Step-Up Authentication
            if (!phoneNumber) {
                return NextResponse.json(
                    { error: 'Phone number required for step-up authentication' },
                    { status: 400 }
                );
            }

            // Mock OTP generation and storage (In production, use Twilio/Authy)
            const otpSessionId = crypto.randomUUID();
            const mockOtp = '123456'; // For testing purposes

            await supabase.from('otp_sessions').insert({
                id: otpSessionId,
                user_id: userId,
                phone_number: phoneNumber,
                otp_code: mockOtp,
                expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
                event_id: eventId,
            });

            // Mock SMS dispatch
            console.log(`[SMS DISPATCH] To: ${phoneNumber}, Code: ${mockOtp}`);

            return NextResponse.json({
                success: true,
                requiresOtp: true,
                otpSessionId,
                message: 'Step-up authentication required. Please check your phone.',
            });
        }
    } catch (error) {
        console.error('RSVP API error:', error);
        return NextResponse.json(
            { error: 'Failed to process RSVP' },
            { status: 500 }
        );
    }
}
