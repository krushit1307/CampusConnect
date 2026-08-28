/**
 * Security and Authentication Types for CampusConnect
 * Defines interfaces for reCAPTCHA verification and step-up authentication flows.
 */

export interface RecaptchaVerificationRequest {
    token: string;
    ip: string;
}

export interface RecaptchaVerificationResponse {
    success: boolean;
    score: number;
    action: string;
    challenge_ts: string;
    hostname: string;
}

export interface StepUpAuthRequest {
    userId: string;
    phoneNumber: string;
    eventId: string;
    recaptchaToken: string;
}

export interface StepUpAuthResponse {
    requiresOtp: boolean;
    otpSessionId?: string;
    message: string;
}
