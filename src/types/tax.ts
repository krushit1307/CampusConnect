/**
 * Tax Compliance Types for CampusConnect
 * Defines interfaces for IRS Form 990-N (e-Postcard) data mapping.
 */

export interface ClubTaxProfile {
    club_id: string;
    legal_name: string;
    ein: string; // Employer Identification Number
    principal_officer_name: string;
    principal_officer_email: string;
    mailing_address: string;
    website: string;
}

export interface FiscalYearSummary {
    fiscal_year: number;
    gross_receipts: number;
    total_transactions: number;
    is_eligible_for_990n: boolean;
}

export interface IRS990NPayload {
    ein: string;
    tax_period_year: number;
    tax_period_month: number;
    legal_name: string;
    principal_officer: string;
    gross_receipts: number;
    website: string;
    mailing_address: string;
    confirmation_statement: boolean;
}
