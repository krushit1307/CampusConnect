/**
 * PasskeyLoginButton – "Sign in with Passkey" button for the Auth page.
 *
 * Only renders when WebAuthn is supported. Falls back gracefully
 * on unsupported browsers (renders nothing).
 *
 * Session creation strategy (handled inside useWebAuthn):
 *   Primary:  verifyOtp({ token_hash, type: "magiclink" }) → session in-place
 *   Fallback: window.location.href = actionLink → Supabase creates session,
 *             then redirects to /auth/passkey-callback → /dashboard
 */

import { useState, useEffect } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { isWebAuthnSupported } from "@/lib/webauthn";
import { useWebAuthn } from "@/hooks/useWebAuthn";

interface PasskeyLoginButtonProps {
    onSuccess: () => void;
    onError: (message: string) => void;
    disabled?: boolean;
}

export function PasskeyLoginButton({
    onSuccess,
    onError,
    disabled = false,
}: PasskeyLoginButtonProps) {
    const [supported, setSupported] = useState(false);
    const { authenticateWithPasskey, isLoading } = useWebAuthn();

    useEffect(() => {
        setSupported(isWebAuthnSupported());
    }, []);

    if (!supported) {
        return null; // Graceful fallback: don't render if WebAuthn not available
    }

    const handleClick = async () => {
        try {
            const result = await authenticateWithPasskey();

            if (!result.success) {
                // Error message already set inside the hook via setError()
                return;
            }

            if (result.sessionEstablished) {
                // Primary path: session was created in-place via verifyOtp token_hash exchange.
                onSuccess();
                return;
            }

            if (result.actionLink) {
                // Fallback path: navigate the browser to the magic link URL.
                // Supabase will create the session and redirect back to
                // /auth/passkey-callback, which then navigates to /dashboard.
                window.location.href = result.actionLink;
                return;
            }

            // Defensive: result.success was true but no session path was available
            onError("Session could not be established. Please try again.");
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "An error occurred during passkey authentication.";
            onError(message);
        }
    };

    return (
        <button
            type="button"
            id="passkey-login-btn"
            onClick={handleClick}
            disabled={disabled || isLoading}
            className="neu-border neu-press w-full flex items-center justify-center gap-2 bg-white border-2 border-black py-3 font-mono text-sm font-bold uppercase text-black hover:bg-lime transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Sign in with Passkey"
        >
            {isLoading ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Authenticating…
                </>
            ) : (
                <>
                    <Fingerprint className="h-4 w-4" />
                    Sign in with Passkey
                </>
            )}
        </button>
    );
}
