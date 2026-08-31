import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertClubNotFrozen, validateTransactionAmount } from '@/lib/finance/budgetFreeze';
import { VendorBidRequest } from '@/types/clubs';
import { authorizeResourceAction } from '@/lib/auth/authorizeResourceAction';
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
const clubId = params.id;

const authorization = await authorizeResourceAction(
    "club",
    clubId,
    "manage_event_resources",
);

if (!authorization.authorized) {
    return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
    );
}

const body: VendorBidRequest = await req.json();
        // 1. Intercept and check if club is frozen
        await assertClubNotFrozen(clubId);

        // 2. Validate that the bid amount won't drop them below minimum reserve
        const isValid = await validateTransactionAmount(clubId, body.amount);
        if (!isValid) {
            return NextResponse.json(
                { error: 'Transaction denied: This purchase would drop your balance below the minimum reserve.' },
                { status: 400 }
            );
        }

        // 3. Process the vendor bid (simplified for this implementation)
        const { data: bid, error: bidError } = await supabase
            .from('vendor_bids')
            .insert({
                club_id: clubId,
                vendor_id: body.vendorId,
                amount: body.amount,
                description: body.description,
                status: 'pending',
            })
            .select()
            .single();

        if (bidError) {
            throw new Error(bidError.message);
        }

        return NextResponse.json({
            success: true,
            message: 'Vendor bid submitted successfully.',
            bid,
        });
    } catch (error) {
        console.error('Vendor bid error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: error instanceof Error && error.message.includes('Frozen') ? 403 : 500 }
        );
    }
}
