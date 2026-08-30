import { NextRequest, NextResponse } from 'next/server';
import { evaluateAndTriggerPayouts } from '@/lib/blockchain/insuranceOracle';

/**
 * Cron job endpoint to evaluate weather conditions and trigger parametric payouts.
 * Secured via cron secret in production.
 */
export async function POST(req: NextRequest) {
    try {
        // Verify cron secret (simplified for artifact)
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const results = await evaluateAndTriggerPayouts();

        return NextResponse.json({
            success: true,
            processed: results.length,
            payouts: results,
        });
    } catch (error) {
        console.error('Insurance cron job error:', error);
        return NextResponse.json(
            { error: 'Failed to process insurance evaluations' },
            { status: 500 }
        );
    }
}
