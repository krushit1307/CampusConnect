import { createClient } from '@supabase/supabase-js';
import { DepositHold } from '@/types/resources';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Creates a hold on a club's ledger balance for a resource deposit.
 * This reduces available spending power without transferring funds.
 */
export async function createDepositHold(
    resourceId: string,
    clubId: string,
    bookingId: string,
    amount: number
): Promise<DepositHold> {
    // Verify club has sufficient balance
    const { data: club, error: clubError } = await supabase
        .from('clubs')
        .select('ledger_balance')
        .eq('id', clubId)
        .single();

    if (clubError || !club) {
        throw new Error('Club not found');
    }

    if (club.ledger_balance < amount) {
        throw new Error(`Insufficient ledger balance. Required: $${amount}, Available: $${club.ledger_balance}`);
    }

    // Create the hold record
    const { data: hold, error: holdError } = await supabase
        .from('resource_deposit_holds')
        .insert({
            resource_id: resourceId,
            club_id: clubId,
            booking_id: bookingId,
            hold_amount: amount,
            status: 'active',
        })
        .select()
        .single();

    if (holdError) {
        throw new Error(`Failed to create deposit hold: ${holdError.message}`);
    }

    // Record the hold in the ledger as a pending transaction
    await supabase.from('ledger_transactions').insert({
        club_id: clubId,
        amount: -amount,
        transaction_type: 'deposit_hold',
        description: `Deposit hold for resource booking (ID: ${bookingId})`,
        status: 'pending',
        reference_id: hold.id,
    });

    return hold;
}

/**
 * Releases an active deposit hold back to the club's available balance.
 */
export async function releaseDepositHold(holdId: string, notes: string = 'Resource returned undamaged'): Promise<void> {
    const { data: hold, error: fetchError } = await supabase
        .from('resource_deposit_holds')
        .select('*')
        .eq('id', holdId)
        .single();

    if (fetchError || !hold) {
        throw new Error('Hold not found');
    }

    if (hold.status !== 'active') {
        throw new Error('Hold is not active');
    }

    // Update hold status
    await supabase
        .from('resource_deposit_holds')
        .update({ status: 'released', resolution_notes: notes })
        .eq('id', holdId);

    // Reverse the pending ledger transaction
    await supabase.from('ledger_transactions').insert({
        club_id: hold.club_id,
        amount: hold.hold_amount,
        transaction_type: 'deposit_hold_release',
        description: `Deposit hold released: ${notes}`,
        status: 'completed',
        reference_id: holdId,
    });
}

/**
 * Converts an active deposit hold into a hard deduction, transferring funds to the University Master Ledger.
 */
export async function convertHoldToDeduction(holdId: string, notes: string = 'Resource damaged'): Promise<void> {
    const { data: hold, error: fetchError } = await supabase
        .from('resource_deposit_holds')
        .select('*')
        .eq('id', holdId)
        .single();

    if (fetchError || !hold) {
        throw new Error('Hold not found');
    }

    if (hold.status !== 'active') {
        throw new Error('Hold is not active');
    }

    // Update hold status
    await supabase
        .from('resource_deposit_holds')
        .update({ status: 'deducted', resolution_notes: notes })
        .eq('id', holdId);

    // Deduct from club ledger
    await supabase.from('ledger_transactions').insert({
        club_id: hold.club_id,
        amount: -hold.hold_amount,
        transaction_type: 'damage_deduction',
        description: `Damage deduction for resource: ${notes}`,
        status: 'completed',
        reference_id: holdId,
    });

    // Credit the University Master Ledger (Assuming a master club ID exists)
    const masterLedgerId = process.env.UNIVERSITY_MASTER_LEDGER_ID;
    if (masterLedgerId) {
        await supabase.from('ledger_transactions').insert({
            club_id: masterLedgerId,
            amount: hold.hold_amount,
            transaction_type: 'damage_reimbursement',
            description: `Reimbursement from club ${hold.club_id} for damaged resource`,
            status: 'completed',
            reference_id: holdId,
        });
    }
}
