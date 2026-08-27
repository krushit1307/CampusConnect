/**
 * Passkey WebAuthn Engine
 * FIDO2 credential registration, Touch ID / Face ID simulation, biometric challenge verifier.
 */

export interface RegisteredPasskey {
    id: string;
    deviceName: string;
    authenticatorType: 'Touch ID' | 'Face ID' | 'YubiKey Security Key';
    createdDate: string;
    lastUsedDate: string;
}

export const MOCK_REGISTERED_PASSKEYS: RegisteredPasskey[] = [
    {
        id: "passkey_1",
        deviceName: "MacBook Pro (Touch ID)",
        authenticatorType: "Touch ID",
        createdDate: "Aug 12, 2026",
        lastUsedDate: "Today"
    },
    {
        id: "passkey_2",
        deviceName: "iPhone 15 Pro (Face ID)",
        authenticatorType: "Face ID",
        createdDate: "Jul 28, 2026",
        lastUsedDate: "Yesterday"
    }
];

export const simulateBiometricAuthentication = (): Promise<{ success: boolean; deviceName: string }> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                success: true,
                deviceName: "MacBook Pro (Touch ID)"
            });
        }, 1200);
    });
};
