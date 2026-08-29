import { NextRequest, NextResponse } from 'next/server';
import { generate990NPayload } from '@/lib/tax/irs990n';

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const clubId = params.id;
        const { fiscalYear } = await req.json();

        if (!fiscalYear) {
            return NextResponse.json(
                { error: 'Missing fiscalYear parameter' },
                { status: 400 }
            );
        }

        const payload = await generate990NPayload(clubId, fiscalYear);

        return NextResponse.json({ success: true, payload });
    } catch (error) {
        console.error('990-N generation error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate 990-N payload' },
            { status: 500 }
        );
    }
}
