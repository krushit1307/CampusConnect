import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkle } from "@/components/site/Sparkle";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — CampusConnect" },
      {
        name: "description",
        content: "Request a password reset link for your CampusConnect account.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const supabase = createClient();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      // Always show the same success state, whether or not the email exists,
      // so we don't leak which addresses have an account.
      setSubmitted(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cream px-4 py-16">
      <Sparkle className="absolute left-8 top-8" size={20} />
      <Sparkle className="absolute right-8 top-8" size={20} />
      <Sparkle className="absolute bottom-8 left-8" size={16} />
      <Sparkle className="absolute bottom-8 right-8" size={16} />
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 inline-block font-display text-2xl font-bold">
          CAMPUS<span className="bg-black px-1 text-cream">CONNECT</span>
        </Link>
        <div className="neu-border bg-white p-8">
          <p className="eyebrow mb-2 font-bold">Forgot password</p>
          <h1 className="mb-6 text-3xl font-bold">Reset your password</h1>

          {submitted ? (
            <div className="space-y-4">
              <div className="bg-lime/40 p-3 font-mono text-sm">
                If an account exists for that email, we&apos;ve sent a link to reset your password.
                Check your inbox (and spam folder).
              </div>
              <Link
                to="/auth"
                className="inline-block font-mono text-xs font-bold underline underline-offset-2"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-6 font-mono text-sm text-gray-600">
                Enter the email associated with your account and we&apos;ll send you a link to reset
                your password.
              </p>
              {error && (
                <div className="mb-4 bg-red-100 p-2 font-mono text-sm text-red-700">{error}</div>
              )}
              <form onSubmit={onSubmit} className="space-y-4">
                <Field
                  label="College email"
                  type="email"
                  name="email"
                  placeholder="you@college.edu"
                  required
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="neu-border neu-press w-full bg-black px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-cream disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
              </form>
              <p className="mt-6 text-center font-mono text-xs">
                Remembered it?{" "}
                <Link to="/auth" className="font-bold underline underline-offset-2">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  name,
  placeholder,
  required,
}: {
  label: string;
  type: string;
  name: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block font-bold">
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
      </span>
      <div className="relative flex items-center border-0 border-b-2 border-black focus-within:bg-lime/40 group">
        <input
          type={type}
          name={name}
          placeholder={placeholder}
          required={required}
          className="w-full bg-transparent px-1 py-2 font-mono text-sm outline-none"
        />
      </div>
    </label>
  );
}
