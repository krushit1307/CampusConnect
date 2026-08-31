import { createClient } from '@supabase/supabase-js';
import { Club, FinancialStatus } from '@/types/clubs';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Checks if a club's budget is frozen and throws an error if so.
 * Used as a middleware/guard in spending endpoints.
 */
export async function assertClubNotFrozen(clubId: string): Promise<void> {
    const { data: club, error } = await supabase
        .from('clubs')
        .select('financial_status, ledger_balance, minimum_reserve, frozen_reason')
        .eq('id', clubId)
        .single();

    if (error || !club) {
        throw new Error('Club not found');
    }

    if (club.financial_status === 'frozen') {
        throw new Error(`Budget Frozen: ${club.frozen_reason || 'Your club\'s budget is frozen due to insufficient funds.'}`);
    }
}

/**
 * Manually freezes a club's budget (e.g., by Student Union Admin).
 */
export async function freezeClubBudget(clubId: string, reason: string): Promise<Club> {
    const { data, error } = await supabase
        .from('clubs')
        .update({
            financial_status: 'frozen',
            frozen_at: new Date().toISOString(),
            frozen_reason: reason,
        })
        .eq('id', clubId)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to freeze club budget: ${error.message}`);
    }

    return data;
}

/**
 * Manually unfreezes a club's budget.
 */
export async function unfreezeClubBudget(clubId: string): Promise<Club> {
    const { data, error } = await supabase
        .from('clubs')
        .update({
            financial_status: 'active',
            frozen_at: null,
            frozen_reason: null,
        })
        .eq('id', clubId)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to unfreeze club budget: ${error.message}`);
    }

    return data;
}

/**
 * Checks if a specific transaction amount would cause the club to drop below the minimum reserve.
 */
export async function validateTransactionAmount(clubId: string, amount: number): Promise<boolean> {
    const { data: club, error } = await supabase
        .from('clubs')
        .select('ledger_balance, minimum_reserve')
        .eq('id', clubId)
        .single();

    if (error || !club) {
        return false;
    }

    return (club.ledger_balance - amount) >= club.minimum_reserve;
}
