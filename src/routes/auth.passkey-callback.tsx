/**
 * /auth/passkey-callback
 *
 * Landing route for the WebAuthn magic-link fallback session flow.
 *
 * When the primary token_hash exchange via verifyOtp() fails, the frontend
 * navigates the browser to Supabase's generated action_link. Supabase Auth
 * processes the link, creates a session, then redirects back here
 * (via the redirectTo=/auth/passkey-callback option in generateLink).
 *
 * On landing, this route:
 *   1. Checks for a PKCE `code` param → exchanges it for a session
 *   2. Falls back to checking for an existing active session
 *   3. Navigates to /dashboard on success, or /auth on failure
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Fingerprint from "lucide-react/dist/esm/icons/fingerprint";
import { Sparkle } from "@/components/site/Sparkle";

type Status = "loading" | "success" | "error";

export default function PasskeyCallbackPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;

    async function handleCallback() {
      try {
        // --------------------------------------------------------------
        // Path A: PKCE code exchange
        // Supabase appends ?code=<value> when redirecting from a magic link
        // in PKCE mode (the modern default for supabase-js v2).
        // --------------------------------------------------------------
        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw new Error(`Code exchange failed: ${error.message}`);
          }
          if (isMounted) {
            setStatus("success");
            setTimeout(() => navigate("/dashboard", { replace: true }), 800);
          }
          return;
        }

        // --------------------------------------------------------------
        // Path B: token_hash / implicit flow
        // Supabase appends #access_token=... in implicit mode, which
        // supabase-js detects automatically via onAuthStateChange.
        // We just need to wait for the session to settle.
        // --------------------------------------------------------------
        const token_hash = searchParams.get("token_hash");
        const type = searchParams.get("type");
        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as "magiclink" | "signup" | "recovery",
          });
          if (error) {
            throw new Error(`Token verification failed: ${error.message}`);
          }
          if (isMounted) {
            setStatus("success");
            setTimeout(() => navigate("/dashboard", { replace: true }), 800);
          }
          return;
        }

        // --------------------------------------------------------------
        // Path C: Session already established (supabase-js picked up the
        // fragment hash automatically before React mounted this component)
        // --------------------------------------------------------------
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          if (isMounted) {
            setStatus("success");
            setTimeout(() => navigate("/dashboard", { replace: true }), 800);
          }
          return;
        }

        // No session and no parameters to exchange — passkey flow failed.
        throw new Error("No authentication data found. The link may have expired.");
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : "Authentication failed.";
        console.error("[PasskeyCallback]", message);
        setErrorMessage(message);
        setStatus("error");

        // Auto-redirect to /auth after a short delay so the user sees the error
        setTimeout(() => {
          if (isMounted) navigate("/auth", { replace: true });
        }, 4000);
      }
    }

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, [navigate, searchParams, supabase]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-purple-300 px-4 py-16">
      <Sparkle className="absolute left-8 top-8" size={20} />
      <Sparkle className="absolute right-8 top-8" size={20} />
      <Sparkle className="absolute bottom-8 left-8" size={16} />
      <Sparkle className="absolute bottom-8 right-8" size={16} />

      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center">
          <span className="font-display text-2xl font-bold text-black">
            CAMPUS
            <span className="bg-black px-1 text-white">CONNECT</span>
          </span>
        </div>

        <div className="neu-border bg-white p-8 text-black">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 rounded-full bg-lime p-4 neu-border">
                <Fingerprint className="h-10 w-10 text-black" />
              </div>
              <Loader2 className="h-6 w-6 animate-spin text-black mb-3" />
              <h1 className="text-xl font-extrabold mb-1">Signing you in…</h1>
              <p className="font-mono text-xs text-gray-600">
                Completing passkey authentication. Please wait.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 rounded-full bg-lime p-4 neu-border">
                <CheckCircle2 className="h-10 w-10 text-black" />
              </div>
              <h1 className="text-xl font-extrabold mb-1">Signed in!</h1>
              <p className="font-mono text-xs text-gray-600">Redirecting you to your dashboard…</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 rounded-full bg-red-200 p-4 neu-border">
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
              <h1 className="text-xl font-extrabold mb-2">Sign-in Failed</h1>
              <p className="font-mono text-xs text-red-700 bg-red-50 p-3 w-full border border-red-200 mb-4">
                {errorMessage ?? "The authentication link was invalid or has expired."}
              </p>
              <p className="font-mono text-xs text-gray-500">Redirecting you back to sign in…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
