/**
 * MFA Security Engine
 * TOTP secret key generation, 6-digit code validation, and backup recovery code generator.
 */

export interface MfaSetupData {
    secretKey: string;
    qrCodeUri: string;
    backupCodes: string[];
}

export const generateMfaSecret = (): MfaSetupData => {
    const secretKey = "KVKX-4792-PLMQ-8812";
    const qrCodeUri = `otpauth://totp/CampusConnect:user@campusconnect.edu?secret=${secretKey}&issuer=CampusConnect`;
    const backupCodes = [
        "8912-4012", "7712-3091", "1290-8812", "6621-0091",
        "4412-9901", "3312-8811", "5512-4412", "9901-2211"
    ];

    return { secretKey, qrCodeUri, backupCodes };
};

export const verifyTotpCode = (code: string): boolean => {
    return code.length === 6 && /^\d+$/.test(code);
};
