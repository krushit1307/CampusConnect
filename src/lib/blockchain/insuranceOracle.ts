import { OracleWeatherResponse, PayoutResult } from '@/types/insurance';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Fetches real-time weather data from NOAA API (mocked for this implementation).
 * In production, this would be a Chainlink External Adapter or dedicated Oracle node.
 */
export async function fetchNOAAWeatherProbability(lat: number, lon: number): Promise<number> {
    // Mock NOAA API response
    // In production: const response = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
    const mockProbability = 75; // Simulating 75% TWAP rain probability
    return mockProbability;
}

/**
 * Evaluates active policies and triggers smart contract payouts if conditions are met.
 * Designed to be run as a daily Cron Job.
 */
export async function evaluateAndTriggerPayouts(): Promise<PayoutResult[]> {
    const results: PayoutResult[] = [];

    // 1. Fetch all active policies where the event date has passed
    const { data: policies, error } = await supabase
        .from('insurance_policies')
        .select('*')
        .eq('isActive', true)
        .eq('isClaimed', false)
        .lte('eventTimestamp', new Date().toISOString());

    if (error || !policies) {
        console.error('Failed to fetch active policies:', error);
        return results;
    }

    for (const policy of policies) {
        try {
            // 2. Ping Oracle for weather probability at the specific GPS coordinates
            const twapProbability = await fetchNOAAWeatherProbability(policy.latitude, policy.longitude);

            // 3. Check parametric condition: TWAP rain probability > 60%
            if (twapProbability > 60) {
                // 4. Trigger autonomous payout (mocked blockchain interaction)
                // In production: await contract.reportWeatherAndTrigger(policy.eventId);

                const mockTxHash = `0x${Math.random().toString(16).substr(2, 40)}`;

                // Update local database state
                await supabase
                    .from('insurance_policies')
                    .update({ isClaimed: true, isActive: false })
                    .eq('eventId', policy.eventId);

                // Credit the club's ledger with the coverage amount
                await supabase.from('ledger_transactions').insert({
                    club_id: policy.clubId,
                    amount: policy.coverageAmount,
                    transaction_type: 'parametric_insurance_payout',
                    description: `Automated DeFi payout for weather cancellation. Tx: ${mockTxHash}`,
                    status: 'completed',
                });

                results.push({
                    success: true,
                    eventId: policy.eventId,
                    payoutAmount: policy.coverageAmount,
                    transactionHash: mockTxHash,
                    message: `Payout of $${policy.coverageAmount} triggered due to ${twapProbability}% 24h TWAP rain probability.`,
                });
            }
        } catch (err) {
            console.error(`Failed to evaluate policy ${policy.eventId}:`, err);
        }
    }

    return results;
}
