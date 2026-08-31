import { createClient } from '@supabase/supabase-js';
import { ClubTaxProfile, FiscalYearSummary, IRS990NPayload } from '@/types/tax';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Calculates the gross receipts for a club's fiscal year.
 * 
 * @param clubId - The ID of the club
 * @param fiscalYear - The fiscal year to calculate (e.g., 2023)
 * @returns Promise<FiscalYearSummary>
 */
export async function calculateFiscalYearSummary(clubId: string, fiscalYear: number): Promise<FiscalYearSummary> {
    const startDate = `${fiscalYear}-01-01T00:00:00Z`;
    const endDate = `${fiscalYear}-12-31T23:59:59Z`;

    const { data, error } = await supabase
        .from('ledger_transactions')
        .select('amount')
        .eq('club_id', clubId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

    if (error) {
        throw new Error(error.message);
    }

    const grossReceipts = data.reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0);

    return {
        fiscal_year: fiscalYear,
        gross_receipts: grossReceipts,
        total_transactions: data.length,
        is_eligible_for_990n: grossReceipts <= 50000,
    };
}

/**
 * Generates a structured payload matching the IRS Form 990-N (e-Postcard) schema.
 * 
 * @param clubId - The ID of the club
 * @param fiscalYear - The fiscal year
 * @returns Promise<IRS990NPayload>
 */
export async function generate990NPayload(clubId: string, fiscalYear: number): Promise<IRS990NPayload> {
    const { data: profile, error: profileError } = await supabase
        .from('club_tax_profiles')
        .select('*')
        .eq('club_id', clubId)
        .single();

    if (profileError || !profile) {
        throw new Error('Club tax profile not found. Please update tax information first.');
    }

    const summary = await calculateFiscalYearSummary(clubId, fiscalYear);

    if (!summary.is_eligible_for_990n) {
        throw new Error(`Gross receipts ($${summary.gross_receipts}) exceed $50,000 limit for 990-N. Form 990-EZ or 990 is required.`);
    }

    return {
        ein: profile.ein,
        tax_period_year: fiscalYear,
        tax_period_month: 12, // Assuming calendar year fiscal period
        legal_name: profile.legal_name,
        principal_officer: profile.principal_officer_name,
        gross_receipts: summary.gross_receipts,
        website: profile.website || 'N/A',
        mailing_address: profile.mailing_address,
        confirmation_statement: true,
    };
}
