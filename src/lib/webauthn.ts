/**
 * WebAuthn / Passkey utility functions for CampusConnect.
 *
 * Handles browser capability detection, credential creation,
 * and credential retrieval using the Web Authentication API.
 */

// Base64URL encoding/decoding utilities
function bufferToBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Detects whether the current browser supports WebAuthn.
 */
export function isWebAuthnSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined" &&
        typeof navigator.credentials !== "undefined" &&
        typeof navigator.credentials.create === "function" &&
        typeof navigator.credentials.get === "function"
    );
}

/**
 * Checks if the device supports platform authenticators (biometrics).
 * Falls back to false on browsers that don't support this check.
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!isWebAuthnSupported()) return false;
    try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
        return false;
    }
}

/**
 * Checks if the browser supports conditional mediation (autofill).
 */
export async function isConditionalMediationSupported(): Promise<boolean> {
    if (!isWebAuthnSupported()) return false;
    try {
        if (
            typeof PublicKeyCredential.isConditionalMediationAvailable === "function"
        ) {
            return await PublicKeyCredential.isConditionalMediationAvailable();
        }
    } catch {
        // Not supported
    }
    return false;
}

export interface WebAuthnRegistrationOptions {
    challenge: string;
    rp: {
        name: string;
        id: string;
    };
    user: {
        id: string;
        name: string;
        displayName: string;
    };
    pubKeyCredParams: Array<{ alg: number; type: string }>;
    excludeCredentials?: Array<{
        id: string;
        type: string;
        transports?: string[];
    }>;
    authenticatorSelection?: {
        authenticatorAttachment?: string;
        residentKey?: string;
        requireResidentKey?: boolean;
        userVerification?: string;
    };
    timeout?: number;
    attestation?: string;
}

export interface WebAuthnAuthOptions {
    challenge: string;
    rpId: string;
    allowCredentials?: Array<{
        id: string;
        type: string;
        transports?: string[];
    }>;
    userVerification?: string;
    timeout?: number;
}

/**
 * Creates a new WebAuthn credential (passkey registration).
 * Calls navigator.credentials.create() with the provided options.
 */
export async function createPasskeyCredential(
    options: WebAuthnRegistrationOptions,
): Promise<{
    credentialId: string;
    clientDataJSON: string;
    attestationObject: string;
    authenticatorData: string;
    transports: string[];
}> {
    if (!isWebAuthnSupported()) {
        throw new Error("WebAuthn is not supported in this browser");
    }

    // Convert base64url strings to ArrayBuffers for the browser API
    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        challenge: base64urlToBuffer(options.challenge),
        rp: {
            name: options.rp.name,
            id: options.rp.id,
        },
        user: {
            id: base64urlToBuffer(options.user.id),
            name: options.user.name,
            displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams.map((p) => ({
            alg: p.alg,
            type: p.type as PublicKeyCredentialType,
        })),
        excludeCredentials: options.excludeCredentials?.map((c) => ({
            id: base64urlToBuffer(c.id),
            type: c.type as PublicKeyCredentialType,
            transports: c.transports as AuthenticatorTransport[] | undefined,
        })),
        authenticatorSelection: options.authenticatorSelection
            ? {
                ...(options.authenticatorSelection.authenticatorAttachment && {
                    authenticatorAttachment: options.authenticatorSelection.authenticatorAttachment as AuthenticatorAttachment,
                }),
                ...(options.authenticatorSelection.residentKey && {
                    residentKey: options.authenticatorSelection.residentKey as ResidentKeyRequirement,
                }),
                ...(options.authenticatorSelection.requireResidentKey !== undefined && {
                    requireResidentKey: options.authenticatorSelection.requireResidentKey as boolean,
                }),
                ...(options.authenticatorSelection.userVerification && {
                    userVerification: options.authenticatorSelection.userVerification as UserVerificationRequirement,
                }),
            }
            : undefined,
        timeout: options.timeout,
        attestation: (options.attestation as AttestationConveyancePreference) || "none",
    };

    const credential = (await navigator.credentials.create({
        publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
        throw new Error("Credential creation was cancelled or failed");
    }

    const response = credential.response as AuthenticatorAttestationResponse;

    // Get transports if available
    let transports: string[] = [];
    try {
        if (typeof response.getTransports === "function") {
            transports = response.getTransports();
        }
    } catch {
        // getTransports not available
    }

    return {
        credentialId: bufferToBase64url(credential.rawId),
        clientDataJSON: bufferToBase64url(response.clientDataJSON),
        attestationObject: bufferToBase64url(response.attestationObject),
        authenticatorData: typeof response.getAuthenticatorData === "function"
            ? bufferToBase64url(response.getAuthenticatorData())
            : "", // Backend verification will safely reject or decode if we implement fallback
        transports,
    };
}

/**
 * Gets a WebAuthn credential (passkey authentication).
 * Calls navigator.credentials.get() with the provided options.
 */
export async function getPasskeyCredential(
    options: WebAuthnAuthOptions,
): Promise<{
    credentialId: string;
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle: string | null;
}> {
    if (!isWebAuthnSupported()) {
        throw new Error("WebAuthn is not supported in this browser");
    }

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        challenge: base64urlToBuffer(options.challenge),
        rpId: options.rpId,
        allowCredentials: options.allowCredentials?.map((c) => ({
            id: base64urlToBuffer(c.id),
            type: c.type as PublicKeyCredentialType,
            ...(c.transports && { transports: c.transports as AuthenticatorTransport[] }),
        })),
        userVerification:
            (options.userVerification as UserVerificationRequirement) || "preferred",
        timeout: options.timeout,
    };

    const credential = (await navigator.credentials.get({
        publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
        throw new Error("Authentication was cancelled or failed");
    }

    const response = credential.response as AuthenticatorAssertionResponse;

    return {
        credentialId: bufferToBase64url(credential.rawId),
        clientDataJSON: bufferToBase64url(response.clientDataJSON),
        authenticatorData: bufferToBase64url(response.authenticatorData),
        signature: bufferToBase64url(response.signature),
        userHandle: response.userHandle
            ? bufferToBase64url(response.userHandle)
            : null,
    };
}

/**
 * Returns the current RP ID (Relying Party ID) based on the hostname.
 */
export function getRpId(): string {
    return window.location.hostname;
}

/**
 * Returns the current origin for WebAuthn validation.
 */
export function getOrigin(): string {
    return window.location.origin;
}

/**
 * Friendly error message for WebAuthn errors.
 */
export function getWebAuthnErrorMessage(error: unknown): string {
    if (error instanceof DOMException) {
        switch (error.name) {
            case "NotAllowedError":
                return "The operation was cancelled or timed out. Please try again.";
            case "SecurityError":
                return "A security error occurred. Make sure you're on a secure connection (HTTPS).";
            case "InvalidStateError":
                return "This passkey is already registered on this device.";
            case "NotSupportedError":
                return "This device doesn't support the requested authentication method.";
            case "AbortError":
                return "The operation was cancelled.";
            default:
                return `Authentication error: ${error.message}`;
        }
    }
    if (error instanceof Error) {
        return error.message;
    }
    return "An unexpected error occurred during authentication.";
}
