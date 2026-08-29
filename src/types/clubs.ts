/**
 * Club Types for CampusConnect
 * Defines interfaces and enums related to club management, status, and financial health.
 */

export type ClubStatus = 'active' | 'probation' | 'suspended' | 'dissolved';
export type FinancialStatus = 'active' | 'frozen' | 'restricted';

export interface Club {
    id: string;
    name: string;
    description: string;
    status: ClubStatus;
    financial_status: FinancialStatus;
    ledger_balance: number;
    minimum_reserve: number;
    president_id: string;
    probation_reason?: string;
    probation_start_date?: string;
    probation_end_date?: string;
    compliance_acknowledged: boolean;
    frozen_at?: string;
    frozen_reason?: string;
    created_at: string;
    updated_at: string;
}

export interface VendorBidRequest {
    clubId: string;
    vendorId: string;
    amount: number;
    description: string;
}
