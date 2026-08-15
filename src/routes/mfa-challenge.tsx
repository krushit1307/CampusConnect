import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Lock from "lucide-react/dist/esm/icons/lock";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import LogOut from "lucide-react/dist/esm/icons/log-out";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function MfaChallengePage() {
  const supabase = createClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  const [status, setStatus] = useState<"loading" | "ready" | "verifying">("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;
      if (aalData?.currentLevel === "aal2") {
        navigate(redirectTo, { replace: true });
        return;
      }

      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factorsData?.totp?.find((f) => f.status === "verified");
      if (cancelled) return;
      if (!verifiedFactor) {
        navigate(redirectTo, { replace: true });
        return;
      }

      const { data: enforced } = await supabase.rpc("is_mfa_enforced_user");
      if (cancelled) return;
      if (!enforced) {
        navigate(redirectTo, { replace: true });
        return;
      }

      setFactorId(verifiedFactor.id);
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: verifiedFactor.id,
      });
      if (cancelled) return;

      if (challengeError) {
        setStatus("ready");
        setErrorMsg(challengeError.message || "Unable to start MFA challenge. Please try again.");
        return;
      }

      setChallengeId(challenge.id);
      setStatus("ready");
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [navigate, redirectTo, supabase]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !challengeId) {
      setErrorMsg("MFA challenge has not started yet. Please refresh and try again.");
      return;
    }
    if (code.length !== 6) {
      setErrorMsg("Please enter the 6-digit code from your authenticator app.");
      return;
    }

    setStatus("verifying");
    setErrorMsg("");

    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });

    if (error) {
      setStatus("ready");
      setCode("");
      setErrorMsg(
        error.message || "Invalid code. Please try again with a fresh code from your app.",
      );
      return;
    }

    toast.success("Two-factor authentication verified.");
    navigate(redirectTo, { replace: true });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-purple-300 px-4">
        <div className="neu-border flex flex-col items-center gap-3 bg-white p-10">
          <Loader2 className="h-8 w-8 animate-spin text-black" />
          <p className="font-mono text-xs font-bold uppercase text-black">Checking security...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-purple-300 px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="font-display text-2xl font-bold text-black">
            CAMPUS<span className="bg-black px-1 text-white">CONNECT</span>
          </Link>
          <Link
            to="/"
            className="neu-border flex items-center gap-1.5 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-black transition-colors hover:bg-black hover:text-cream cursor-pointer"
            aria-label="Return to Home page"
          >
            <ArrowLeft size={14} />
            Home
          </Link>
        </div>

        <div className="neu-border bg-white p-8 shadow-[8px_8px_0_0_var(--color-ink)]">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center border-2 border-black bg-yellow-300">
              <ShieldCheck className="h-7 w-7 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-black font-display">
                Two-Factor Authentication
              </h1>
              <p className="font-mono text-xs text-gray-600">
                Complete this step to unlock your account.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-4" noValidate>
            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2 border-2 border-black bg-red-100 p-3 font-mono text-xs text-red-900"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                {errorMsg}
              </div>
            )}

            <div>
              <label className="eyebrow mb-2 block font-bold text-black">
                Authenticator security code
              </label>
              <p className="mb-2 font-mono text-xs text-gray-600">
                Enter the 6-digit code shown in your authenticator app (Google Authenticator,
                1Password, Authy, etc.).
              </p>
              <Input
                type="text"
                maxLength={6}
                placeholder="000000"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="border-2 border-black font-mono text-center text-2xl font-bold tracking-widest py-3"
                aria-label="6-digit authenticator code"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSignOut}
                className="flex-1 border-2 border-black font-mono text-xs uppercase"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Sign out
              </Button>
              <Button
                type="submit"
                disabled={status === "verifying" || code.length !== 6}
                className="flex-1 border-2 border-black bg-black text-cream hover:bg-black/90 font-mono text-xs uppercase font-bold shadow-[3px_3px_0_0_var(--color-ink)]"
              >
                {status === "verifying" ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Lock className="h-4 w-4 mr-1" />
                )}
                Verify &amp; Continue
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
