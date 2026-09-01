import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { tx_id } = await req.json();
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Fetch the transaction details
        const { data: tx, error: txError } = await supabase
            .from('club_transactions')
            .select('*')
            .eq('id', tx_id)
            .single();

        if (txError || !tx) {
            throw new Error('Transaction not found');
        }

        const flaggedReasons: string[] = [];
        let isAnomalous = false;

        // 2. Define heuristics
        const restrictedCategories = ['Liquor Store', 'Personal Goods', 'Grocery'];
        const winterBreakStart = new Date(`${new Date().getFullYear()}-12-15`);
        const winterBreakEnd = new Date(`${new Date().getFullYear() + 1}-01-15`);
        const txDate = new Date(tx.transaction_date);

        // Heuristic A: Vendor categorized as restricted
        if (restrictedCategories.includes(tx.vendor_category)) {
            flaggedReasons.push(`Restricted vendor category: ${tx.vendor_category}`);
            isAnomalous = true;
        }

        // Heuristic B: Date during Winter Break
        if (txDate >= winterBreakStart && txDate <= winterBreakEnd) {
            flaggedReasons.push('Transaction occurred during Winter Break');
            isAnomalous = true;
        }

        // Heuristic C: Amount > 3 standard deviations from club's average
        const { data: stats, error: statsError } = await supabase.rpc('get_club_transaction_stats', {
            p_club_id: tx.club_id
        });

        if (!statsError && stats && stats.length > 0) {
            const avg = parseFloat(stats[0].avg_amount);
            const stdDev = parseFloat(stats[0].std_dev_amount);

            if (stdDev > 0 && tx.amount > (avg + (3 * stdDev))) {
                flaggedReasons.push(`Amount ($${tx.amount}) exceeds 3 standard deviations from club average ($${avg.toFixed(2)})`);
                isAnomalous = true;
            }
        }

        // 3. If heuristics trigger, flag the transaction
        if (isAnomalous) {
            const { error: updateError } = await supabase
                .from('club_transactions')
                .update({
                    status: 'pending_audit',
                    flagged_reasons: flaggedReasons,
                    audited_at: new Date().toISOString(),
                })
                .eq('id', tx_id);

            if (updateError) {
                throw new Error('Failed to update transaction status');
            }

            // 4. Block further withdrawals (handled via RLS in migration, but we can also flag the club)
            await supabase
                .from('clubs')
                .update({ requires_admin_clearance: true })
                .eq('id', tx.club_id);
        }

        return new Response(
            JSON.stringify({
                tx_id,
                is_anomalous: isAnomalous,
                flagged_reasons: flaggedReasons,
                requires_manual_review: isAnomalous,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
