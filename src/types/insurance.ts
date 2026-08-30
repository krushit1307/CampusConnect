/**
 * Decentralized Insurance Types for CampusConnect
 * Defines interfaces for parametric policies and oracle responses.
 */

export interface InsurancePolicy {
    eventId: string;
    clubId: string;
    premiumPaid: number;
    coverageAmount: number;
    isActive: boolean;
    isClaimed: boolean;
    eventTimestamp: string;
    latitude: number;
    longitude: number;
}

export interface OracleWeatherResponse {
    eventId: string;
    precipitationInches: number;
    timestamp: string;
    source: 'NOAA' | 'OpenWeather';
}

export interface PayoutResult {
    success: boolean;
    eventId: string;
    payoutAmount: number;
    transactionHash?: string;
    message: string;
}
