import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Processes a CPC click, checking for fraud, deducting from sponsor escrow,
 * and crediting the club's ledger.
 */
export async function processCPCClick(
    sponsorSettingId: string,
    userId: string | null,
    ipAddress: string
): Promise<{ allowed: boolean; message: string; redirectUrl?: string }> {
    // 1. Fetch sponsor setting
    const { data: setting, error: settingError } = await supabase
        .from('sponsor_cpc_settings')
        .select('*, sponsors(club_id, name, logo_url, target_url)')
        .eq('id', sponsorSettingId)
        .eq('is_active', true)
        .single();

    if (settingError || !setting) {
        return { allowed: false, message: 'Sponsor setting not found or inactive' };
    }

    // 2. Check if budget is exhausted
    if (setting.current_spent >= setting.max_budget) {
        // Deactivate the setting if budget is hit
        await supabase
            .from('sponsor_cpc_settings')
            .update({ is_active: false })
            .eq('id', sponsorSettingId);

        return { allowed: false, message: 'Sponsor budget exhausted', isBudgetExhausted: true };
    }

    // 3. Fraud prevention: Check for duplicate clicks from same IP within 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentClicks, error: clickError } = await supabase
        .from('sponsor_clicks')
        .select('id')
        .eq('sponsor_setting_id', sponsorSettingId)
        .eq('ip_address', ipAddress)
        .gte('clicked_at', oneHourAgo);

    if (recentClicks && recentClicks.length > 0) {
        return { allowed: false, message: 'Click rate limit exceeded. Please try again later.' };
    }

    // 4. Record the click
    await supabase.from('sponsor_clicks').insert({
        sponsor_setting_id: sponsorSettingId,
        user_id: userId,
        ip_address: ipAddress,
    });

    // 5. Update sponsor spent amount
    const newSpent = setting.current_spent + setting.cost_per_click;
    await supabase
        .from('sponsor_cpc_settings')
        .update({ current_spent: newSpent })
        .eq('id', sponsorSettingId);

    // 6. Ledger transactions: Deduct from sponsor, credit to club
    const clubId = setting.sponsors.club_id;

    // Deduct from sponsor (assuming sponsor has a ledger or escrow account)
    await supabase.from('ledger_transactions').insert({
        club_id: setting.sponsor_id, // Using sponsor_id as pseudo-club for escrow
        amount: -setting.cost_per_click,
        transaction_type: 'sponsor_cpc_charge',
        description: `CPC charge for event click`,
        status: 'completed',
    });

    // Credit the event's club
    await supabase.from('ledger_transactions').insert({
        club_id: clubId,
        amount: setting.cost_per_click,
        transaction_type: 'sponsor_cpc_revenue',
        description: `Revenue from sponsor CPC click`,
        status: 'completed',
    });

    return {
        allowed: true,
        message: 'Click processed successfully',
        redirectUrl: setting.sponsors.target_url
    };
}
