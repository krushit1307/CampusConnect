import { NextRequest, NextResponse } from 'next/server';
import { processCPCClick } from '@/lib/sponsors/cpcTracking';
import { ClickTrackingRequest } from '@/types/sponsors';

export async function POST(req: NextRequest) {
    try {
        const body: ClickTrackingRequest = await req.json();
        const ipAddress = req.headers.get('x-forwarded-for') || req.ip || 'unknown';

        const result = await processCPCClick(
            body.sponsorSettingId,
            body.userId,
            ipAddress
        );

        if (!result.allowed) {
            return NextResponse.json(
                { error: result.message, isBudgetExhausted: result.message.includes('exhausted') },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            redirectUrl: result.redirectUrl,
        });
    } catch (error) {
        console.error('CPC tracking error:', error);
        return NextResponse.json(
            { error: 'Failed to process click' },
            { status: 500 }
        );
    }
}
