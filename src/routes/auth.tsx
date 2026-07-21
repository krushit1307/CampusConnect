import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Sparkle } from "@/components/site/Sparkle";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordStrengthMeter, getPasswordStrength } from "@/components/ui/password-strength";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const supabase = createClient();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      toast.error("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              full_name: `${firstName} ${lastName}`.trim(),
            },
          },
        });

        if (signUpError) throw signUpError;

        navigate("/dashboard", { replace: true });
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        navigate("/dashboard", { replace: true });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

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
            to="/"
            className="neu-border flex items-center gap-1.5 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-black transition-colors hover:bg-black hover:text-cream"
          >
            <ArrowLeft size={14} />
            Home
          </Link>
        </div>

        <div className="neu-border bg-white p-8">
          <div key={mode} className="auth-mode-transition">
            <p className="eyebrow mb-2 font-bold text-black">
              {mode === "signin" ? "Welcome back" : "Get started"}
            </p>

            <h1 className="mb-6 text-3xl font-bold text-blue-900">
              {mode === "signin" ? "Sign in to CampusConnect" : "Create your account"}
            </h1>

            {error && (
              <div className="mb-4 bg-red-100 p-2 font-mono text-sm text-red-700">{error}</div>
            )}

            <form onSubmit={onSubmit} className="space-y-4 text-red-900">
              {mode === "signup" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="First name"
                    type="text"
                    name="firstName"
                    placeholder="Ada"
                    autoComplete="given-name"
                    required
                  />
                  <Field
                    label="Last name"
                    type="text"
                    name="lastName"
                    placeholder="Lovelace"
                    autoComplete="family-name"
                    required
                  />
                </div>
              )}

              <Field
                label="College email"
                type="email"
                name="email"
                placeholder="you@college.edu"
                autoComplete={mode === "signup" ? "email" : "username"}
                required
              />

              <Field
                label="Password"
                type="password"
                name="password"
                placeholder="********"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                value={mode === "signup" ? password : undefined}
                onChange={mode === "signup" ? (e) => setPassword(e.target.value) : undefined}
              />

              {mode === "signup" && password && <PasswordStrengthMeter password={password} />}

              {mode === "signup" && (
                <Field
                  label="Confirm password"
                  type="password"
                  name="confirmPassword"
                  placeholder="********"
                  autoComplete="new-password"
                  required
                />
              )}

              {mode === "signin" && (
                <p className="text-right text-blue-600">
                  <Link
                    to="/forgot-password"
                    className="font-mono text-xs font-bold underline underline-offset-2"
                  >
                    Forgot password?
                  </Link>
                </p>
              )}

              <Button
                type="submit"
                disabled={
                  loading || (mode === "signup" && getPasswordStrength(password) === "weak")
                }
                className="w-full bg-blue-600 text-white hover:bg-blue-400"
              >
                {loading ? "Loading..." : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-[2px] flex-1 bg-black" />
              <span className="eyebrow font-bold text-black">or</span>
              <div className="h-[2px] flex-1 bg-black" />
            </div>

            <Button
              onClick={handleGoogleSignIn}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              Continue with Google
            </Button>

            <p className="mt-6 text-center font-mono text-xs text-black">
              {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                  setPassword("");
                }}
                className="h-auto p-0 font-bold underline text-blue-600"
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </Button>
            </p>
          </div>
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
  autoComplete,
  rightElement,
  value,
  onChange,
}: {
  label: string;
  type: string;
  name: string;
  placeholder: string;
  required?: boolean;
  autoComplete?: string;
  rightElement?: React.ReactNode;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block font-bold">
        {label}
        {required && (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </span>

      <div className="group relative flex items-center border-0 border-b-2 border-black focus-within:bg-lime/40">
        {type === "password" ? (
          <PasswordInput
            name={name}
            placeholder={placeholder}
            required={required}
            autoComplete={autoComplete}
            value={value}
            onChange={onChange}
            className="w-full bg-transparent px-1 py-2 font-mono text-sm outline-none"
          />
        ) : (
          <input
            type={type}
            name={name}
            placeholder={placeholder}
            required={required}
            autoComplete={autoComplete}
            className="w-full bg-transparent px-1 py-2 font-mono text-sm outline-none"
          />
        )}

        {rightElement && (
          <div className="absolute right-2 flex items-center justify-center">{rightElement}</div>
        )}
      </div>
    </label>
  );
}
