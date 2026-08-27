/**
 * Security Session Engine
 * Session activity models, IP geolocation parsing, session revocation reducers, and security posture scoring.
 */

export interface LoginSessionItem {
    id: string;
    deviceName: string;
    browser: string;
    ipAddress: string;
    location: string;
    lastActive: string;
    isCurrent: boolean;
}

export const MOCK_LOGIN_SESSIONS: LoginSessionItem[] = [
    {
        id: "sess_1",
        deviceName: "MacBook Pro 16-inch",
        browser: "Chrome v128.0 (macOS)",
        ipAddress: "192.168.1.42",
        location: "San Jose, CA, USA",
        lastActive: "Active Now",
        isCurrent: true
    },
    {
        id: "sess_2",
        deviceName: "iPhone 15 Pro",
        browser: "Mobile Safari (iOS 17.5)",
        ipAddress: "172.56.21.90",
        location: "San Francisco, CA, USA",
        lastActive: "2 hours ago",
        isCurrent: false
    }
];

export const calculateSecurityPostureScore = (mfaEnabled: boolean, passkeyRegistered: boolean, activeSessionCount: number) => {
    let score = 50;
    if (mfaEnabled) score += 30;
    if (passkeyRegistered) score += 20;
    if (activeSessionCount > 3) score -= 10;
    return Math.min(100, Math.max(0, score));
};
