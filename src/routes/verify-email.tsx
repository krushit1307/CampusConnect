import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { Sparkle } from "@/components/site/Sparkle";
import { CheckCircle2, AlertCircle, Loader2, ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const supabase = createClient();

  const token = searchParams.get("token") || searchParams.get("token_hash");
  const type = searchParams.get("type") || "signup";

  useEffect(() => {
    async function handleVerification() {
      if (!token) {
        setLoading(false);
        setError("Verification token is missing or invalid.");
        return;
      }

      try {
        // Attempt OTP / Token hash verification with Supabase
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type === "recovery" ? "recovery" : "signup",
        });

        if (verifyError) {
          // If verifyOtp direct call failed, check if active session exists and is confirmed
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user?.email_confirmed_at) {
            setVerified(true);
            setLoading(false);
            return;
          }
          throw verifyError;
        }

        setVerified(true);
        toast.success("Email verified successfully! Welcome to CampusConnect.");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to verify email address.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    handleVerification();
  }, [token, type, supabase]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-purple-300 px-4 py-16">
      <Sparkle className="absolute left-8 top-8" size={20} />
      <Sparkle className="absolute right-8 top-8" size={20} />
      <Sparkle className="absolute bottom-8 left-8" size={16} />
      <Sparkle className="absolute bottom-8 right-8" size={16} />

      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="font-display text-2xl font-bold text-black">
            CAMPUS
            <span className="bg-black px-1 text-white">CONNECT</span>
          </Link>

          <Link
            to="/auth"
            className="neu-border flex items-center gap-1.5 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-black transition-colors hover:bg-black hover:text-cream cursor-pointer"
          >
            <ArrowLeft size={14} />
            Sign in
          </Link>
        </div>

        <div className="neu-border bg-white p-8 text-black">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-black mb-4" />
              <h2 className="text-xl font-bold">Verifying your email...</h2>
              <p className="mt-2 font-mono text-xs text-gray-600">
                Please wait while we validate your email confirmation token.
              </p>
            </div>
          ) : verified ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="mb-4 rounded-full bg-lime p-3 neu-border">
                <CheckCircle2 className="h-10 w-10 text-black" />
              </div>
              <h1 className="text-2xl font-extrabold mb-2">Email Verified!</h1>
              <p className="font-mono text-sm text-gray-700 mb-6">
                Your email has been successfully confirmed. You can now access all features on
                CampusConnect.
              </p>

              <button
                type="button"
                onClick={() => navigate("/dashboard", { replace: true })}
                className="neu-border neu-press w-full bg-black py-3 font-mono text-sm font-bold uppercase text-cream cursor-pointer"
              >
                Go to Dashboard &rarr;
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center py-4">
              <div className="mb-4 rounded-full bg-red-200 p-3 neu-border">
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
              <h1 className="text-2xl font-extrabold mb-2">Verification Failed</h1>
              <p className="font-mono text-xs text-red-700 bg-red-50 p-3 w-full border border-red-200 mb-6">
                {error || "The link may be invalid or has expired."}
              </p>

              <div className="space-y-3 w-full">
                <Link
                  to="/auth"
                  className="neu-border neu-press block w-full bg-black py-3 text-center font-mono text-sm font-bold uppercase text-cream cursor-pointer"
                >
                  Return to Sign In
                </Link>

                <p className="font-mono text-xs text-gray-500 pt-2">
                  Need a new verification link? Try signing in or request email resend from your
                  profile settings.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
