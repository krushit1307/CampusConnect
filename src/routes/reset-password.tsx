import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Sparkle } from "@/components/site/Sparkle";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordStrengthMeter, getPasswordStrength } from "@/components/ui/password-strength";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [checkingLink, setCheckingLink] = useState(true);
  const [linkValid, setLinkValid] = useState(false);
  const navigate = useNavigate();
  const supabase = createClient();

  // The Supabase client parses the recovery token out of the magic-link URL and
  // exchanges it for a session automatically. We just need to wait for that to
  // happen (or for a PASSWORD_RECOVERY auth event) before showing the form.
  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setLinkValid(true);
        setCheckingLink(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session) {
        setLinkValid(true);
      }
      setCheckingLink(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password.length < 8) {
      const message = "Password must be at least 8 characters.";
      setError(message);
      toast.error(message);
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      const message = "Passwords do not match.";
      setError(message);
      toast.error(message);
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      toast.success("Password updated. Please sign in with your new password.");
      // Sign out of the recovery session so the new password is required going forward.
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
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
        <Link to="/" className="mb-6 inline-block font-display text-2xl font-bold text-black">
          CAMPUS<span className="bg-black px-1 text-amber-300">CONNECT</span>
        </Link>
        <div className="neu-border bg-white p-8">
          <p className="eyebrow mb-2 font-bold text-black">Reset password</p>
          <h1 className="mb-6 text-3xl font-bold text-indigo-900">Choose a new password</h1>

          {checkingLink ? (
            <p className="font-mono text-sm text-gray-600">Checking your reset link...</p>
          ) : !linkValid ? (
            <div className="space-y-4">
              <div className="bg-red-100 p-3 font-mono text-sm text-red-700">
                This reset link is invalid or has expired. Please request a new one.
              </div>
              <Link
                to="/forgot-password"
                className="inline-block font-mono text-xs font-bold underline underline-offset-2 text-black"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 bg-red-100 p-2 font-mono text-sm text-red-700">{error}</div>
              )}
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <Field
                    label="New password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="********"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    rightElement={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPassword(!showPassword)}
                        className="flex items-center justify-center p-1 text-black hover:scale-105 transition-transform outline-none"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </Button>
                    }
                  />
                  <PasswordStrengthMeter password={password} />
                </div>
                <Field
                  label="Confirm new password"
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="********"
                  required
                />
                <Button
                  type="submit"
                  disabled={loading || getPasswordStrength(password) === "weak"}
                  variant="primary"
                  className="w-full"
                >
                  {loading ? "Updating..." : "Update password"}
                </Button>
              </form>
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
  rightElement,
  value,
  onChange,
}: {
  label: string;
  type: string;
  name: string;
  placeholder: string;
  required?: boolean;
  rightElement?: React.ReactNode;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
          value={value}
          onChange={onChange}
          className="w-full bg-transparent px-1 py-2 font-mono text-sm outline-none"
        />
        {rightElement && (
          <div className="absolute right-2 flex items-center justify-center">{rightElement}</div>
        )}
      </div>
    </label>
  );
}
