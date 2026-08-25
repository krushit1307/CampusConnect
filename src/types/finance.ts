/**
 * TypeScript Data Models for Financial Inventory & Depreciation
 */

export type AssetClassId = 'ELECTRONICS' | 'FURNITURE' | 'VEHICLES' | 'EVENT_GEAR' | 'SOFTWARE' | string;

export interface AssetClass {
    id: AssetClassId;
    name: string;
    description: string;
    lifespan_years: number;
    salvage_value_percent: number;
    created_at?: string;
}

export type ItemCondition = 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'BROKEN';

export interface InventoryItem {
    id: string;
    club_id: string;
    name: string;
    purchase_date: string | null;
    purchase_price: number | null;
    asset_class: AssetClassId | null;
    condition_status: ItemCondition;
    created_at: string;
    updated_at: string;
}

export interface InventoryItemWithValuation extends InventoryItem {
    net_book_value: number;
    percent_lifespan_used: number;
}

export interface BalanceSheetCategory {
    category: string;
    historical_cost_total: number;
    accumulated_depreciation: number;
    net_book_value: number;
}

export interface ClubBalanceSheet {
    categories: BalanceSheetCategory[];
    grand_total: BalanceSheetCategory;
    as_of_date: string;
    generated_at: string;
}

export interface DepreciationCalculationRequest {
    purchase_price: number;
    purchase_date: string;
    lifespan_years: number;
    salvage_percent: number;
    target_date?: string;
}

export interface AssetForecast {
    year: number;
    date: string;
    value: number;
    depreciation_expense: number;
}

/**
 * Finance and Transaction Types for CampusConnect
 * Defines interfaces for club spending, anomaly detection, and audit workflows.
 */

export type TransactionStatus = 'completed' | 'pending' | 'pending_audit' | 'rejected';

export interface ClubTransaction {
    id: string;
    club_id: string;
    amount: number;
    vendor_name: string;
    vendor_category: string;
    transaction_date: string;
    description: string;
    status: TransactionStatus;
    flagged_reasons: string[];
    created_at: string;
    updated_at: string;
}

export interface AnomalyAuditResult {
    tx_id: string;
    is_anomalous: boolean;
    flagged_reasons: string[];
    club_average: number;
    club_std_dev: number;
    requires_manual_review: boolean;
}

export interface AuditHeuristics {
    max_std_dev_multiplier: number;
    restricted_categories: string[];
    winter_break_start: string;
    winter_break_end: string;
}
